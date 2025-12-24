
const Product = require("../models/Product");
const PDFDocument = require("pdfkit");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");
const https = require('https');
const http = require('http');

// ============================================
// HELPER: Convert image to buffer (ROBUST VERSION)
// ============================================
const getImageBuffer = async (imagePathOrUrl) => {
    try {
        console.log('🖼️  Loading image:', imagePathOrUrl);

        if (!imagePathOrUrl) {
            console.log('   ⚠️  No image path provided');
            return null;
        }

        // Handle HTTP/HTTPS URLs
        if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
            console.log('   📡 Fetching from URL...');

            return new Promise((resolve, reject) => {
                const protocol = imagePathOrUrl.startsWith('https') ? https : http;
                const timeout = 20000; // 20 seconds

                const req = protocol.get(imagePathOrUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive'
                    }
                }, (res) => {
                    // Handle redirects
                    if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                        console.log(`   🔄 Redirect to: ${res.headers.location}`);
                        return getImageBuffer(res.headers.location).then(resolve).catch(reject);
                    }

                    if (res.statusCode !== 200) {
                        console.error(`   ❌ HTTP ${res.statusCode}: ${res.statusMessage}`);
                        resolve(null);
                        return;
                    }

                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        console.log(`   ✅ Downloaded ${buffer.length} bytes`);
                        resolve(buffer);
                    });
                    res.on('error', (err) => {
                        console.error(`   ❌ Stream error:`, err.message);
                        resolve(null);
                    });
                });

                req.on('error', (err) => {
                    console.error(`   ❌ Request error:`, err.message);
                    resolve(null);
                });

                req.setTimeout(timeout, () => {
                    console.error(`   ❌ Timeout after ${timeout}ms`);
                    req.destroy();
                    resolve(null);
                });

                req.end();
            });
        }

        // Handle local file paths
        console.log('   📁 Loading local file...');

        // Clean up the path
        let cleanPath = imagePathOrUrl.replace(/\\/g, '/');

        // Try multiple path variations
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
                    const buffer = await fs.readFile(tryPath);
                    console.log(`   ✅ Loaded from: ${tryPath} (${buffer.length} bytes)`);
                    return buffer;
                }
            } catch (err) {
                // Continue to next path
                continue;
            }
        }

        console.error(`   ❌ File not found in any location`);
        console.error(`   Tried paths:`, pathVariations.slice(0, 5).join('\n   '));
        return null;

    } catch (error) {
        console.error('   ❌ Error:', error.message);
        return null;
    }
};

// ============================================
// HELPER: Validate image buffer for PDFKit
// ============================================
const isValidImageBuffer = (buffer) => {
    if (!buffer || buffer.length === 0) {
        return false;
    }

    // Check for common image file signatures
    const signatures = {
        jpeg: [0xFF, 0xD8, 0xFF],
        png: [0x89, 0x50, 0x4E, 0x47],
        gif: [0x47, 0x49, 0x46],
        webp: [0x52, 0x49, 0x46, 0x46] // RIFF
    };

    // Check JPEG
    if (buffer[0] === signatures.jpeg[0] &&
        buffer[1] === signatures.jpeg[1] &&
        buffer[2] === signatures.jpeg[2]) {
        console.log('   ✅ Valid JPEG image');
        return true;
    }

    // Check PNG
    if (buffer[0] === signatures.png[0] &&
        buffer[1] === signatures.png[1] &&
        buffer[2] === signatures.png[2] &&
        buffer[3] === signatures.png[3]) {
        console.log('   ✅ Valid PNG image');
        return true;
    }

    // Check GIF
    if (buffer[0] === signatures.gif[0] &&
        buffer[1] === signatures.gif[1] &&
        buffer[2] === signatures.gif[2]) {
        console.log('   ✅ Valid GIF image');
        return true;
    }

    // Check WebP
    if (buffer[0] === signatures.webp[0] &&
        buffer[1] === signatures.webp[1] &&
        buffer[2] === signatures.webp[2] &&
        buffer[3] === signatures.webp[3]) {
        console.log('   ✅ Valid WebP image');
        return true;
    }

    console.log('   ⚠️  Unknown image format');
    return false;
};

// ============================================
// HELPER: Number to words
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

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📄 GENERATING PDF FOR PRODUCT: ${id}`);
        console.log(`${'='.repeat(60)}\n`);

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

        // ============================================
        // LOAD LOGO
        // ============================================
        console.log('🏢 LOADING COMPANY LOGO...');
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
            logoBuffer = await getImageBuffer(logoPath);
            if (logoBuffer && isValidImageBuffer(logoBuffer)) {
                break;
            }
        }

        // ============================================
        // PROCESS ITEMS WITH IMAGES
        // ============================================
        console.log(`\n📦 PROCESSING ${product.items?.length || 0} ITEMS...\n`);

        const processedItems = [];
        let successCount = 0;
        let failCount = 0;

        for (let index = 0; index < (product.items || []).length; index++) {
            const itemEntry = product.items[index];
            const item = itemEntry.item;

            if (!item) {
                console.warn(`⚠️  Item ${index + 1}: NULL/UNDEFINED - Skipping`);
                continue;
            }

            console.log(`\n📌 Item ${index + 1}: ${item.name || 'Unnamed'}`);
            console.log(`   Image field value: ${item.image || 'null'}`);

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

            // Load item image
            let imageBuffer = null;
            if (item.image) {
                imageBuffer = await getImageBuffer(item.image);
                if (imageBuffer && isValidImageBuffer(imageBuffer)) {
                    successCount++;
                    console.log(`   ✅ IMAGE LOADED SUCCESSFULLY`);
                } else {
                    failCount++;
                    console.log(`   ❌ IMAGE LOAD FAILED`);
                }
            } else {
                console.log(`   ℹ️  No image path in database`);
            }

            processedItems.push({
                serialNo: index + 1,
                name: item.name || 'N/A',
                description: item.description || '',
                code: item._id?.toString().slice(-8).toUpperCase() || '',
                rate,
                qty,
                amount,
                imageBuffer,
                hasImage: !!(imageBuffer && isValidImageBuffer(imageBuffer))
            });
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 IMAGE LOADING SUMMARY:`);
        console.log(`   Total items: ${processedItems.length}`);
        console.log(`   ✅ Images loaded: ${successCount}`);
        console.log(`   ❌ Images failed: ${failCount}`);
        console.log(`   📭 No image: ${processedItems.length - successCount - failCount}`);
        console.log(`${'='.repeat(60)}\n`);

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
        // CREATE PDF
        // ============================================
        console.log('📝 CREATING PDF DOCUMENT...\n');
        const doc = new PDFDocument({
            size: 'A4',
            margin: 30,
            bufferPages: true
        });

        // Collect PDF data
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            const sanitizedName = (product.name || 'Customer').replace(/[^a-z0-9]/gi, '_');
            const filename = `Quotation_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;

            console.log(`\n✅ PDF GENERATED SUCCESSFULLY`);
            console.log(`   Filename: ${filename}`);
            console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

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
        if (logoBuffer && isValidImageBuffer(logoBuffer)) {
            try {
                doc.image(logoBuffer, 40, 40, {
                    fit: [60, 60]
                });
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
        doc.fontSize(8).font('Helvetica').text('JAL CHHAYA ROW HOUSE, SATELLITE ROAD,', 110, 63);
        doc.text('PUNA, MOTA VARACHHA', 110, 73);
        doc.text('Surat Gujarat - 394101', 110, 83);
        doc.text('98255 32006', 110, 93);

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
        console.log('🎨 RENDERING ITEMS IN PDF...\n');
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

            // Image
            if (item.hasImage && item.imageBuffer) {
                try {
                    doc.image(item.imageBuffer, colX[3] + 5, y + 5, {
                        fit: [60, 60]
                    });
                    console.log(`   ✅ Rendered: Item ${i + 1}`);
                } catch (err) {
                    console.error(`   ❌ Render failed: Item ${i + 1} - ${err.message}`);
                    doc.rect(colX[3] + 5, y + 5, 60, 60).stroke();
                    doc.fontSize(7).text('Error', colX[3] + 15, y + 30, { width: 40, align: 'center' });
                }
            } else {
                doc.rect(colX[3] + 5, y + 5, 60, 60).stroke();
                doc.fontSize(7).text('No Image', colX[3] + 10, y + 30, { width: 50, align: 'center' });
            }

            // Price, Qty, Disc, Amount
            doc.fontSize(8).font('Helvetica');
            doc.text(item.rate.toFixed(2), colX[4] + 2, y + 30, { width: colWidths[4] - 4, align: 'right' });
            doc.text(item.qty.toFixed(2), colX[5] + 2, y + 30, { width: colWidths[5] - 4, align: 'center' });
            doc.text(discountPercent.toFixed(2), colX[6] + 2, y + 30, { width: colWidths[6] - 4, align: 'right' });
            doc.text(item.amount.toFixed(2), colX[7] + 2, y + 30, { width: colWidths[7] - 4, align: 'right' });

            y += rowHeight;
        }

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

        // Summary rows
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

        // Final amount
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
        // BRANDS SECTION WITH LOGOS
        // ============================================
        y += 70;
        if (y > 680) {
            doc.addPage();
            y = 40;
        }

        console.log('\n🏷️  LOADING BRAND LOGOS...\n');

        // Brand logos with URLs (Update these URLs with actual working logo URLs)
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
                const logoBuffer = await getImageBuffer(brand.logo);
                if (logoBuffer && isValidImageBuffer(logoBuffer)) {
                    console.log(`   ✅ ${brand.name} logo loaded`);
                    return { ...brand, logoBuffer };
                } else {
                    console.log(`   ⚠️  ${brand.name} logo failed, using text`);
                    return { ...brand, logoBuffer: null };
                }
            })
        );

        // Draw brands section
        // doc.rect(30, y, 535, 80).stroke();

        const brandCols = 4;
        const brandWidth = 535 / brandCols;
        const brandHeight = 80 / 3;

        // Render each brand
        brandLogos.forEach((brand, i) => {
            const col = i % brandCols;
            const row = Math.floor(i / brandCols);
            const bx = 30 + col * brandWidth;
            const by = y + row * brandHeight;

            // Draw cell border
            // doc.rect(bx, by, brandWidth, brandHeight).stroke();

            if (brand.logoBuffer) {
                try {
                    // Display logo image
                    doc.image(brand.logoBuffer, bx + 10, by + 5, {
                        fit: [brandWidth - 20, brandHeight - 10],
                        align: 'center',
                        valign: 'center'
                    });
                } catch (err) {
                    console.error(`   ❌ Error rendering ${brand.name}:`, err.message);
                    // Fallback to text
                    doc.fontSize(9).font('Helvetica-Bold')
                        .text(brand.name, bx, by + (brandHeight / 2) - 5, {
                            width: brandWidth,
                            align: 'center'
                        });
                }
            } else {
                // Fallback to text if logo not available
                doc.fontSize(9).font('Helvetica-Bold')
                    .text(brand.name, bx, by + (brandHeight / 2) - 5, {
                        width: brandWidth,
                        align: 'center'
                    });
            }
        });

        console.log('✅ Brand section completed\n');

        // ============================================
        // FOOTER
        // ============================================
        y += 90;
        // doc.rect(30, y, 535, 80).stroke();
        doc.fontSize(8).font('Helvetica');
        doc.text('For', 480, y + 10);
        doc.font('Helvetica-Bold').text('RAJ TILES', 480, y + 22);

        // doc.moveTo(450, y + 55).lineTo(555, y + 55).stroke();
        doc.text('Authorized Signatory', 450, y + 58, { width: 105, align: 'center' });

        doc.end();

    } catch (error) {
        console.error("\n❌ PDF GENERATION ERROR:");
        console.error(error);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "PDF generation failed",
                error: error.message
            });
        }
    }
};
