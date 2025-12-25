const Product = require("../models/Product");
const PDFDocument = require("pdfkit");
const fs = require("fs").promises;
const path = require("path");
const https = require('https');
const http = require('http');
const sharp = require('sharp');

// ============================================
// HELPER: Download image with timeout and retries
// ============================================
const downloadImage = async (url, timeout = 30000, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`   📥 Download attempt ${attempt}/${retries}: ${url}`);
            
            return await new Promise((resolve, reject) => {
                const protocol = url.startsWith('https') ? https : http;
                
                const req = protocol.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Connection': 'keep-alive',
                    }
                }, (res) => {
                    // Handle redirects
                    if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                        console.log(`   🔄 Redirect ${res.statusCode} -> ${res.headers.location}`);
                        req.destroy();
                        return downloadImage(res.headers.location, timeout, 1)
                            .then(resolve)
                            .catch(reject);
                    }

                    if (res.statusCode !== 200) {
                        console.error(`   ❌ HTTP ${res.statusCode}: ${res.statusMessage}`);
                        req.destroy();
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                        return;
                    }

                    const chunks = [];
                    let downloadedSize = 0;
                    
                    res.on('data', (chunk) => {
                        chunks.push(chunk);
                        downloadedSize += chunk.length;
                    });

                    res.on('end', () => {
                        try {
                            const buffer = Buffer.concat(chunks);
                            console.log(`   ✅ Download complete: ${(buffer.length / 1024).toFixed(2)} KB`);
                            resolve(buffer);
                        } catch (err) {
                            console.error(`   ❌ Buffer concat error:`, err.message);
                            reject(err);
                        }
                    });

                    res.on('error', (err) => {
                        console.error(`   ❌ Response error:`, err.message);
                        reject(err);
                    });
                });

                req.on('error', (err) => {
                    console.error(`   ❌ Request error:`, err.message);
                    reject(err);
                });

                req.on('timeout', () => {
                    console.error(`   ⏱️  Request timeout after ${timeout}ms`);
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                req.setTimeout(timeout);
                req.end();
            });

        } catch (error) {
            console.error(`   ❌ Attempt ${attempt} failed:`, error.message);
            
            if (attempt === retries) {
                throw error;
            }
            
            // Exponential backoff
            const waitTime = 1000 * Math.pow(2, attempt - 1);
            console.log(`   ⏳ Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    throw new Error('All download attempts failed');
};

// ============================================
// HELPER: Convert any image to JPEG buffer for PDFKit
// ============================================
const convertToJPEG = async (buffer, options = {}) => {
    const {
        width = 300,
        height = 300,
        quality = 90,
        fit = 'inside'
    } = options;

    try {
        console.log(`   🔄 Converting to JPEG for PDFKit...`);
        console.log(`   📐 Target size: ${width}x${height}, quality: ${quality}%`);
        
        // Convert to JPEG - PDFKit works best with standard JPEG
        const convertedBuffer = await sharp(buffer)
            .resize(width, height, {
                fit: fit,
                withoutEnlargement: true,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .jpeg({
                quality: quality,
                progressive: false, // PDFKit prefers non-progressive
                force: true // Force JPEG format
            })
            .toBuffer();

        console.log(`   ✅ Converted to JPEG: ${(convertedBuffer.length / 1024).toFixed(2)} KB`);
        return convertedBuffer;

    } catch (error) {
        console.error(`   ❌ Conversion failed:`, error.message);
        throw error;
    }
};

// ============================================
// HELPER: Load image from URL or file path
// ============================================
const getImageBuffer = async (imagePathOrUrl, retries = 3) => {
    try {
        console.log(`\n🖼️  Loading image: ${imagePathOrUrl}`);

        if (!imagePathOrUrl || imagePathOrUrl === 'null' || imagePathOrUrl === 'undefined') {
            console.log('   ⚠️  Invalid image path');
            return null;
        }

        let rawBuffer = null;

        // Handle HTTP/HTTPS URLs
        if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
            console.log('   🌐 Fetching from URL...');
            rawBuffer = await downloadImage(imagePathOrUrl, 30000, retries);
        } 
        // Handle local file paths
        else {
            console.log('   📁 Loading local file...');
            const cleanPath = imagePathOrUrl.replace(/\\/g, '/');

            const pathVariations = [
                cleanPath,
                cleanPath.replace(/^\/+/, ''),
                path.join(process.cwd(), cleanPath),
                path.join(process.cwd(), cleanPath.replace(/^\/+/, '')),
                path.join(process.cwd(), 'public', cleanPath.replace(/^\/+/, '')),
                path.join(process.cwd(), 'src', 'public', cleanPath.replace(/^\/+/, '')),
                path.join(process.cwd(), 'uploads', cleanPath.replace(/^\/+/, '')),
                path.join(__dirname, '..', cleanPath),
                path.join(__dirname, '..', cleanPath.replace(/^\/+/, '')),
                path.join(__dirname, '..', 'public', cleanPath.replace(/^\/+/, '')),
                path.join(__dirname, '..', 'uploads', cleanPath.replace(/^\/+/, ''))
            ];

            for (const tryPath of pathVariations) {
                try {
                    const stats = await fs.stat(tryPath);
                    if (stats.isFile()) {
                        rawBuffer = await fs.readFile(tryPath);
                        console.log(`   ✅ File found: ${tryPath}`);
                        console.log(`   📦 Size: ${(rawBuffer.length / 1024).toFixed(2)} KB`);
                        break;
                    }
                } catch (err) {
                    continue;
                }
            }

            if (!rawBuffer) {
                console.error('   ❌ File not found in any location');
                return null;
            }
        }

        // Convert to standard JPEG for PDFKit
        if (rawBuffer && rawBuffer.length > 0) {
            const jpegBuffer = await convertToJPEG(rawBuffer, {
                width: 300,
                height: 300,
                quality: 90,
                fit: 'inside'
            });
            
            return jpegBuffer;
        }

        return null;

    } catch (error) {
        console.error(`   ❌ Image loading failed:`, error.message);
        return null;
    }
};

// ============================================
// HELPER: Create placeholder image
// ============================================
const createPlaceholder = async (text = 'No Image', width = 300, height = 300) => {
    try {
        const svg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${width}" height="${height}" fill="#f5f5f5"/>
                <rect x="10" y="10" width="${width-20}" height="${height-20}" 
                      fill="none" stroke="#ddd" stroke-width="2" stroke-dasharray="5,5"/>
                <text x="${width/2}" y="${height/2-10}" 
                      font-family="Arial, sans-serif" 
                      font-size="16" 
                      fill="#999" 
                      text-anchor="middle" 
                      dominant-baseline="middle">
                    ${text}
                </text>
                <text x="${width/2}" y="${height/2+15}" 
                      font-family="Arial, sans-serif" 
                      font-size="12" 
                      fill="#bbb" 
                      text-anchor="middle" 
                      dominant-baseline="middle">
                    (Image not available)
                </text>
            </svg>
        `;
        
        const jpegBuffer = await sharp(Buffer.from(svg))
            .jpeg({ quality: 90, progressive: false })
            .toBuffer();
            
        console.log(`   ✅ Placeholder created: ${text}`);
        return jpegBuffer;
        
    } catch (error) {
        console.error('   ❌ Placeholder creation failed:', error.message);
        return null;
    }
};

// ============================================
// HELPER: Validate image buffer
// ============================================
const isValidImageBuffer = (buffer) => {
    if (!buffer || !Buffer.isBuffer(buffer)) return false;
    if (buffer.length < 100) return false; // Too small to be valid image
    
    // Check for common image signatures
    const header = buffer.slice(0, 12);
    
    // JPEG: FF D8 FF
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return true;
    
    // PNG: 89 50 4E 47
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return true;
    
    // GIF: 47 49 46
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) return true;
    
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) return true;
    
    return false;
};

// ============================================
// HELPER: Number to words (Indian system)
// ============================================
const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (num === 0) return 'Zero';

    const convertLessThanThousand = (n) => {
        if (n === 0) return '';
        if (n < 10) return ones[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };

    if (num < 1000) return convertLessThanThousand(num);
    if (num < 100000) {
        return convertLessThanThousand(Math.floor(num / 1000)) + ' Thousand' +
            (num % 1000 !== 0 ? ' ' + convertLessThanThousand(num % 1000) : '');
    }
    if (num < 10000000) {
        return convertLessThanThousand(Math.floor(num / 100000)) + ' Lakh' +
            (num % 100000 !== 0 ? ' ' + numberToWords(num % 100000) : '');
    }
    return convertLessThanThousand(Math.floor(num / 10000000)) + ' Crore' +
        (num % 10000000 !== 0 ? ' ' + numberToWords(num % 10000000) : '');
};

// ============================================
// HELPER: Format date
// ============================================
const formatDate = (date) => new Date(date).toLocaleDateString("en-GB", {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
});

// ============================================
// MAIN PDF GENERATION FUNCTION
// ============================================
exports.generatePDF = async (req, res) => {
    try {
        const userId = req.query.userId;
        const { id } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required"
            });
        }

        console.log(`\n${'='.repeat(70)}`);
        console.log(`📄 PDF GENERATION STARTED`);
        console.log(`   Product ID: ${id}`);
        console.log(`   User ID: ${userId}`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);
        console.log(`${'='.repeat(70)}\n`);

        // Fetch product
        const product = await Product.findById(id).populate("items.item").lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check authorization
        if (product.createdBy && product.createdBy.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        // Calculate values
        const discountPercent = parseFloat(product.dis) || 0;
        const isNRP = product.value === 'nrp';
        const isMRP = product.value === 'mrp';
        const isManual = product.value === 'manual';
        const includeGst = product.includeGst === true;

        console.log(`📊 Product Details:`);
        console.log(`   Name: ${product.name || 'N/A'}`);
        console.log(`   Items count: ${product.items?.length || 0}`);
        console.log(`   Discount: ${discountPercent}%`);
        console.log(`   GST included: ${includeGst}`);

        // ============================================
        // LOAD LOGO
        // ============================================
        console.log(`\n${'='.repeat(70)}`);
        console.log('🏢 LOADING COMPANY LOGO');
        console.log(`${'='.repeat(70)}\n`);
        
        let logoBuffer = null;
        const possibleLogoPaths = [
            'public/logo.jpg',
            'public/logo.png',
            'uploads/logo.jpg',
            'uploads/logo.png',
            'src/public/logo.jpg',
            'logo.jpg',
        ];

        for (const logoPath of possibleLogoPaths) {
            logoBuffer = await getImageBuffer(logoPath, 2);
            if (logoBuffer) {
                console.log(`✅ Logo loaded successfully from: ${logoPath}`);
                break;
            }
        }

        if (!logoBuffer) {
            console.log('⚠️  Logo not found, will use text fallback');
        }

        // ============================================
        // PROCESS ITEMS WITH IMAGES
        // ============================================
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📦 PROCESSING ${product.items?.length || 0} ITEMS`);
        console.log(`${'='.repeat(70)}\n`);

        const itemPromises = (product.items || []).map(async (itemEntry, index) => {
            const item = itemEntry.item;

            if (!item) {
                console.warn(`⚠️  Item ${index + 1}: NULL/UNDEFINED - Skipping`);
                return null;
            }

            console.log(`\n📌 ITEM ${index + 1}: ${item.name || 'Unnamed'}`);
            console.log(`   SKU: ${item._id?.toString().slice(-8).toUpperCase() || 'N/A'}`);
            console.log(`   Image path: ${item.image || 'null'}`);

            // Calculate rate
            let rate = 0;
            if (isManual) {
                rate = itemEntry.manualPrice || 0;
            } else if (isNRP) {
                rate = parseFloat(item.nrp) || 0;
            } else if (isMRP) {
                rate = parseFloat(item.mrp) || 0;
            }

            const qty = parseFloat(itemEntry.quantity) || 1;
            const amount = rate * qty;

            console.log(`   💰 Price: ₹${rate.toFixed(2)}`);
            console.log(`   📦 Quantity: ${qty}`);
            console.log(`   💵 Amount: ₹${amount.toFixed(2)}`);

            // Load item image - this is the key fix
            let imageBuffer = null;
            let imageStatus = 'no_image';

            if (item.image && item.image !== 'null' && item.image !== 'undefined') {
                imageBuffer = await getImageBuffer(item.image, 3);
                
                if (imageBuffer) {
                    imageStatus = 'loaded';
                    console.log(`   ✅ IMAGE LOADED SUCCESSFULLY`);
                } else {
                    imageStatus = 'failed';
                    console.log(`   ❌ IMAGE LOAD FAILED - Creating placeholder`);
                    imageBuffer = await createPlaceholder('Image\nUnavailable');
                }
            } else {
                console.log(`   ℹ️  No image path provided - Creating placeholder`);
                imageBuffer = await createPlaceholder('No Image');
                imageStatus = 'no_image';
            }

            return {
                serialNo: index + 1,
                name: item.name || 'N/A',
                description: item.description || '',
                code: item._id?.toString().slice(-8).toUpperCase() || '',
                rate,
                qty,
                amount,
                imageBuffer,
                imageStatus
            };
        });

        const processedItemsWithNulls = await Promise.all(itemPromises);
        const processedItems = processedItemsWithNulls.filter(item => item !== null);

        // Summary
        const loadedCount = processedItems.filter(i => i.imageStatus === 'loaded').length;
        const failedCount = processedItems.filter(i => i.imageStatus === 'failed').length;
        const noImageCount = processedItems.filter(i => i.imageStatus === 'no_image').length;

        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 IMAGE LOADING SUMMARY:`);
        console.log(`   Total items: ${processedItems.length}`);
        console.log(`   ✅ Successfully loaded: ${loadedCount}`);
        console.log(`   ⚠️  Failed (with placeholder): ${failedCount}`);
        console.log(`   📭 No image path: ${noImageCount}`);
        console.log(`${'='.repeat(70)}\n`);

        // ============================================
        // LOAD BRAND LOGOS
        // ============================================
        console.log(`\n${'='.repeat(70)}`);
        console.log('🏷️  LOADING BRAND LOGOS');
        console.log(`${'='.repeat(70)}\n`);

        const brands = [
            { name: 'Jaquar', logo: 'https://vectorseek.com/wp-content/uploads/2023/10/Jaguar-experience-bathing-Logo-Vector.svg-.png' },
            { name: 'Kerakoll', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxdLM5berBUYOfvDlOo1OsCzDnUsotvOn5Iw&s' },
            { name: 'Roff', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSQJ3VThg4g9B7ywtwvAcAFEtnJVp0_g0Scw&s' },
            { name: 'Somany', logo: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Somany-logo.png' },
            { name: 'Simola', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTrM4XAxTLjWz2i2kdI3batGVFu8eRlRiQayQ&s' },
            { name: 'SEGA', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/SEGA_logo.svg/2560px-SEGA_logo.svg.png' },
            { name: 'MYK LATICRETE', logo: 'https://paintnhardware.com/img/m/36.jpg' },
            { name: 'SONARA', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS40jZAwXnZ4cKRIH3hHWaMkvr3IuxIPaHZlg&s' },
            { name: 'Wintouch', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSkjsl6g8SySMOY0dniGNz4ysEHxWonZpArKQ&s' },
            { name: 'AGILIS', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQw7wcfU54HqDOP0FcZ40A7zM2OJAQ2Xu_R_w&s' },
            { name: 'LEMZON', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqtIJxBe9zU7xngcSco2CbRZcu0SmQB1Fo_w&s' },
            { name: 'LEZORA', logo: 'https://media.licdn.com/dms/image/v2/C4E0BAQHpDcGzwFqILw/company-logo_200_200/company-logo_200_200/0/1630650109134/lezora_vitrified_pvt_ltd__logo?e=2147483647&v=beta&t=hzhLwhQZZS6FFQJvug7Nb9yozaFS_IB5qZ0Wo-kLiQA' }
        ];

        // Load all brand logos in parallel
        const brandLogos = await Promise.all(
            brands.map(async (brand) => {
                console.log(`   Loading: ${brand.name}`);
                const logoBuffer = await getImageBuffer(brand.logo, 2);
                if (logoBuffer && isValidImageBuffer(logoBuffer)) {
                    console.log(`   ✅ ${brand.name} logo loaded`);
                    return { ...brand, logoBuffer };
                } else {
                    console.log(`   ⚠️  ${brand.name} logo failed, using text`);
                    return { ...brand, logoBuffer: null };
                }
            })
        );

        console.log(`\n✅ Brand logos loaded: ${brandLogos.filter(b => b.logoBuffer).length}/${brands.length}\n`);

        // Calculate totals
        const othersTotal = processedItems.reduce((sum, item) => sum + item.amount, 0);
        const totalAmount = othersTotal;
        const netAmount = othersTotal;
        const totalWithoutDiscount = othersTotal / (1 - discountPercent / 100);
        const cgst = includeGst ? (othersTotal * 0.09) : 0;
        const sgst = includeGst ? (othersTotal * 0.09) : 0;
        const totalAmountWithGst = othersTotal + cgst + sgst;
        const roundOff = Math.round(totalAmountWithGst) - totalAmountWithGst;
        const finalAmount = Math.round(totalAmountWithGst);

        // ============================================
        // CREATE PDF DOCUMENT
        // ============================================
        console.log(`\n${'='.repeat(70)}`);
        console.log('📝 CREATING PDF DOCUMENT');
        console.log(`${'='.repeat(70)}\n`);

        const doc = new PDFDocument({
            size: 'A4',
            margin: 30,
            bufferPages: true,
            autoFirstPage: true
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            const sanitizedName = (product.name || 'Customer').replace(/[^a-z0-9]/gi, '_');
            const filename = `Quotation_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;

            console.log(`\n${'='.repeat(70)}`);
            console.log(`✅ PDF GENERATED SUCCESSFULLY`);
            console.log(`   Filename: ${filename}`);
            console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
            console.log(`   Pages: ${doc.bufferedPageRange().count}`);
            console.log(`${'='.repeat(70)}\n`);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.end(pdfBuffer);
        });

        let y = 40;

        // ============================================
        // HEADER SECTION
        // ============================================
        doc.rect(30, 30, 535, 140).stroke();

        // Logo
        if (logoBuffer) {
            try {
                doc.image(logoBuffer, 40, 40, { fit: [60, 60] });
            } catch (err) {
                console.error('❌ Logo render error:', err.message);
                doc.rect(40, 40, 60, 60).stroke();
                doc.fontSize(20).text('RT', 50, 60);
            }
        } else {
            doc.rect(40, 40, 60, 60).stroke();
            doc.fontSize(20).text('RT', 50, 60);
        }

        // Company info
        doc.fontSize(16).font('Helvetica-Bold').text('Raj TILES', 110, 45);
        doc.fontSize(8).font('Helvetica').text('3, Rameshwar Complex, Kapodra-Hirawag,', 110, 63);
        doc.text('Varachha Road, Surat.', 110, 73);
        doc.text('98255 32006', 110, 83);

        // Header right
        doc.fontSize(9).font('Helvetica-Bold').text('Original', 480, 45);
        doc.fontSize(8).font('Helvetica');
        doc.text(`Quotation No: ${product._id?.toString().slice(-8).toUpperCase()}`, 420, 60);
        doc.text(`Date: ${formatDate(product.date)}`, 420, 72);
        doc.text(`Validity: ${formatDate(new Date(product.date).getTime() + 15 * 24 * 60 * 60 * 1000)}`, 420, 84);

        // Quotation title
        y = 110;
        doc.rect(30, y, 535, 20).stroke();
        doc.fontSize(14).font('Helvetica-Bold').text('Quotation', 30, y + 5, { width: 535, align: 'center' });

        // Buyer and Consignee
        y = 135;
        doc.fontSize(9).font('Helvetica-Bold').text('Buyer (Bill To):', 40, y);
        doc.fontSize(8).font('Helvetica').text(product.name || 'CUSTOMER', 40, y + 12);
        doc.text(product.address || 'Surat, Gujarat', 40, y + 22, { width: 220 });
        doc.text('State: Gujarat, Code: 24', 40, y + 38);
        doc.text(`M: ${product.number || '0000000000'}`, 40, y + 48);

        doc.fontSize(9).font('Helvetica-Bold').text('Consignee (Ship To):', 320, y);
        doc.fontSize(8).font('Helvetica').text(product.consigneeName || product.name || 'CUSTOMER', 320, y + 12);
        doc.text(product.consigneeAddress || product.address || 'Surat, Gujarat', 320, y + 22, { width: 220 });
        doc.text('State: Gujarat, Code: 24', 320, y + 38);
        doc.text(`M: ${product.consigneeMobile || product.number || '0000000000'}`, 320, y + 48);

        // ============================================
        // ITEMS TABLE
        // ============================================
        y = 200;
        doc.rect(30, y, 535, 20).fillAndStroke('#f0f0f0', '#000');
        doc.fillColor('#000').fontSize(9).font('Helvetica-Bold').text('Items', 30, y + 6, { width: 535, align: 'center' });

        // Table header
        y += 20;
        const colWidths = [30, 150, 60, 70, 55, 50, 50, 70];
        const colX = [30, 60, 210, 270, 340, 395, 445, 495];
        const headers = ['SR.NO', 'DESCRIPTION', 'SKU CODE', 'IMAGE', 'PRICE', 'QTY', 'DISC%', 'AMOUNT'];

        doc.rect(30, y, 535, 25).fillAndStroke('#f0f0f0', '#000');
        doc.fillColor('#000').fontSize(8).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, colX[i] + 2, y + 8, { width: colWidths[i] - 4, align: 'center' });
        });

        y += 25;

        // Table rows
        console.log('\n🎨 RENDERING ITEMS IN PDF...\n');
        for (let i = 0; i < processedItems.length; i++) {
            const item = processedItems[i];
            const rowHeight = 70;

            if (y + rowHeight > 750) {
                doc.addPage();
                y = 40;
            }

            doc.rect(30, y, 535, rowHeight).stroke();

            // Vertical lines
            colX.slice(1).forEach(x => {
                doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
            });

            doc.fontSize(8).font('Helvetica');

            // Serial No
            doc.text(item.serialNo.toString(), colX[0] + 2, y + 30, { width: colWidths[0] - 4, align: 'center' });

            // Description
            doc.font('Helvetica-Bold').text(item.name, colX[1] + 4, y + 8, { width: colWidths[1] - 8 });
            if (item.description) {
                doc.fontSize(7).font('Helvetica').fillColor('#666')
                    .text(item.description, colX[1] + 4, y + 20, { width: colWidths[1] - 8 });
                doc.fillColor('#000');
            }

            // SKU Code
            doc.fontSize(8).text(item.code || '-', colX[2] + 2, y + 30, { width: colWidths[2] - 4, align: 'center' });

            // ============================================
            // IMAGE RENDERING - KEY FIX
            // ============================================
            if (item.imageBuffer) {
                try {
                    // PDFKit's image() method with proper options
                    doc.image(item.imageBuffer, colX[3] + 5, y + 5, {
                        fit: [60, 60],
                        align: 'center',
                        valign: 'center'
                    });
                    console.log(`   ✅ [${i + 1}/${processedItems.length}] Rendered: ${item.name}`);
                } catch (renderErr) {
                    console.error(`   ❌ [${i + 1}/${processedItems.length}] Render failed: ${renderErr.message}`);
                    // Fallback: draw rectangle
                    doc.rect(colX[3] + 5, y + 5, 60, 60).stroke();
                    doc.fontSize(7).fillColor('#999')
                        .text('Error', colX[3] + 20, y + 30, { width: 30, align: 'center' });
                    doc.fillColor('#000');
                }
            } else {
                // No image buffer available
                doc.rect(colX[3] + 5, y + 5, 60, 60).stroke();
                doc.fontSize(7).fillColor('#999')
                    .text('No Image', colX[3] + 15, y + 30, { width: 30, align: 'center' });
                doc.fillColor('#000');
            }

            // Reset font
            doc.fontSize(8).font('Helvetica').fillColor('#000');

            // Price, Qty, Disc, Amount
            doc.text(item.rate.toFixed(2), colX[4] + 2, y + 30, { width: colWidths[4] - 4, align: 'right' });
            doc.text(item.qty.toFixed(2), colX[5] + 2, y + 30, { width: colWidths[5] - 4, align: 'center' });
            doc.text(discountPercent.toFixed(2), colX[6] + 2, y + 30, { width: colWidths[6] - 4, align: 'right' });
            doc.text(item.amount.toFixed(2), colX[7] + 2, y + 30, { width: colWidths[7] - 4, align: 'right' });

            y += rowHeight;
        }

        console.log('\n✅ All items rendered successfully\n');

        // ============================================
        // SUMMARY SECTION
        // ============================================
        if (y > 600) {
            doc.addPage();
            y = 40;
        }

        y += 10;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Total', 40, y);
        doc.text('Others + Total Amount', 300, y);
        doc.text(othersTotal.toFixed(2), 505, y, { width: 60, align: 'right' });

        y += 20;
        doc.rect(30, y, 535, 15).fillAndStroke('#f0f0f0', '#000');
        doc.fillColor('#000').fontSize(8).font('Helvetica-Bold');
        doc.text('SR. NO.', 35, y + 4, { width: 100 });
        doc.text('AREA', 135, y + 4, { width: 200, align: 'center' });
        doc.text('NET AMOUNT', 335, y + 4, { width: 225, align: 'center' });

        y += 15;
        doc.rect(30, y, 535, 15).stroke();
        doc.fontSize(8).font('Helvetica');
        doc.text('26', 35, y + 4, { width: 100, align: 'center' });
        doc.text('Others', 135, y + 4, { width: 200, align: 'center' });
        doc.text(othersTotal.toFixed(2), 490, y + 4, { width: 70, align: 'right' });

        const summaryRows = [
            ['Total Amount', totalAmount.toFixed(2), true],
            ['Net Amount', netAmount.toFixed(2), true],
            ['Total without Discount:', totalWithoutDiscount.toFixed(2), false],
        ];

        if (includeGst) {
            summaryRows.push(
                ['CGST (9%):', cgst.toFixed(2), false],
                ['SGST (9%):', sgst.toFixed(2), false]
            );
        }

        summaryRows.push(
            ['Total Amount:', totalAmountWithGst.toFixed(2), false],
            ['Round Off:', roundOff.toFixed(2), false]
        );

        y += 15;
        summaryRows.forEach(([label, value, isBold]) => {
            doc.rect(30, y, 535, 15).stroke();
            if (isBold) {
                doc.fontSize(8).font('Helvetica-Bold');
                doc.rect(30, y, 335, 15).fillAndStroke('#f0f0f0', '#000');
                doc.fillColor('#000');
            } else {
                doc.fontSize(8).font('Helvetica');
            }
            doc.text(label, 35, y + 4, { width: 300, align: isBold ? 'left' : 'right' });
            doc.text(value, 490, y + 4, { width: 70, align: 'right' });
            y += 15;
        });

        doc.rect(30, y, 335, 20).fillAndStroke('#000', '#000');
        doc.rect(365, y, 200, 20).fillAndStroke('#000', '#000');
        doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold');
        doc.text('Final Amount:', 35, y + 6);
        doc.text(finalAmount.toFixed(2), 490, y + 6, { width: 70, align: 'right' });
        doc.fillColor('#000');

        y += 25;
        doc.fontSize(8).font('Helvetica-Bold').text('Amount in words: ', 35, y);
        doc.font('Helvetica').text(`${numberToWords(finalAmount)} Rupees Only`, 120, y);

        y += 15;
        doc.fontSize(7).fillColor('#666').text('Please find below items are also available please contact for further details.', 35, y);
        doc.fillColor('#000');

        // ============================================
        // TERMS & CONDITIONS
        // ============================================
        y += 20;
        doc.rect(30, y, 535, 60).stroke();
        doc.fontSize(10).font('Helvetica-Bold').text('Terms & Conditions:', 40, y + 5);
        doc.fontSize(8).font('Helvetica');
        doc.text('• No return policy – Sold goods will not be taken back.', 40, y + 20);
        doc.text('• Free delivery on truckload orders.', 40, y + 30);
        doc.text('• Delivery orders must be placed at least 15 days in advance.', 40, y + 40);
        doc.text('• Only Cash Rate.', 40, y + 50);

        // ============================================
        // BRAND LOGOS SECTION
        // ============================================
        y += 70;
        
        // Check if we need a new page
        const brandsHeight = Math.ceil(brandLogos.length / 4) * 27; // 4 columns, ~27px per row
        if (y + brandsHeight > 750) {
            doc.addPage();
            y = 40;
        }

        console.log('\n🎨 RENDERING BRAND LOGOS...\n');

        const brandCols = 4;
        const brandWidth = 535 / brandCols; // ~133.75px per column
        const brandHeight = 80 / 3; // ~26.67px per row

        // Render each brand
        brandLogos.forEach((brand, i) => {
            const col = i % brandCols;
            const row = Math.floor(i / brandCols);
            const bx = 30 + col * brandWidth;
            const by = y + row * brandHeight;

            if (brand.logoBuffer) {
                try {
                    doc.image(brand.logoBuffer, bx + 10, by + 5, {
                        fit: [brandWidth - 20, brandHeight - 10],
                        align: 'center',
                        valign: 'center'
                    });
                    console.log(`   ✅ Rendered: ${brand.name}`);
                } catch (err) {
                    console.error(`   ❌ Error rendering ${brand.name}:`, err.message);
                    doc.fontSize(9).font('Helvetica-Bold')
                        .text(brand.name, bx, by + (brandHeight / 2) - 5, {
                            width: brandWidth,
                            align: 'center'
                        });
                }
            } else {
                doc.fontSize(9).font('Helvetica-Bold')
                    .text(brand.name, bx, by + (brandHeight / 2) - 5, {
                        width: brandWidth,
                        align: 'center'
                    });
            }
        });

        y += brandsHeight + 10;

        // ============================================
        // FOOTER
        // ============================================
        if (y > 700) {
            doc.addPage();
            y = 40;
        }

        doc.fontSize(8).font('Helvetica');
        doc.text('For', 480, y + 10);
        doc.font('Helvetica-Bold').text('RAJ TILES', 480, y + 22);
        doc.text('Authorized Signatory', 450, y + 58, { width: 105, align: 'center' });

        console.log('\n✅ Brand logos rendered successfully\n');

        doc.end();

    } catch (error) {
        console.error("\n" + "=".repeat(70));
        console.error("❌ PDF GENERATION ERROR");
        console.error("=".repeat(70));
        console.error(error);
        console.error("=".repeat(70) + "\n");

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "PDF generation failed",
                error: error.message
            });
        }
    }
};
