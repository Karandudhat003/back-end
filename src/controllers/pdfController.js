
const Product = require("../models/Product");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path"); 

// ============================================
// 🔥 CHROME DETECTION HELPER
// ============================================
const getBrowserConfig = async () => {
    // Check if chrome-aws-lambda is available (serverless environments)
    try {
        const chromium = require('chrome-aws-lambda');
        console.log('✅ Using chrome-aws-lambda');
        return {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        };
    } catch (error) {
        console.log('ℹ️ chrome-aws-lambda not available, using local Chrome');
    }

    // Check for environment variable
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        console.log('✅ Using PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
        return {
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        };
    }

    // Try common Chrome locations
    const possiblePaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        process.env.HOME + '/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome'
    ];

    for (const chromePath of possiblePaths) {
        try {
            await fs.access(chromePath);
            console.log('✅ Found Chrome at:', chromePath);
            return {
                headless: 'new',
                executablePath: chromePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            };
        } catch (err) {
            continue;
        }
    }

    // Default config - let Puppeteer find it
    console.log('⚠️ Using default Puppeteer config');
    return {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    };
};

// ============================================
// HELPER: Convert image to base64
// ============================================
const toBase64 = async (imagePathOrUrl) => {
    try {
        if (!imagePathOrUrl.startsWith('http')) {
            const absolutePath = path.resolve(__dirname, '..', imagePathOrUrl.replace(/^\//, ''));

            try {
                await fs.access(absolutePath);
                const buffer = await fs.readFile(absolutePath);
                const ext = path.extname(absolutePath).toLowerCase();

                let mimeType = 'image/png';
                if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                else if (ext === '.svg') mimeType = 'image/svg+xml';
                else if (ext === '.gif') mimeType = 'image/gif';
                else if (ext === '.webp') mimeType = 'image/webp';

                return `data:${mimeType};base64,${buffer.toString('base64')}`;
            } catch (err) {
                console.error('Local image not found:', absolutePath);
                return '';
            }
        }

        const response = await fetch(imagePathOrUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) return '';

        const buffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'image/png';
        return `data:${contentType};base64,${buffer.toString('base64')}`;

    } catch (error) {
        console.error('Image conversion error:', error.message);
        return '';
    }
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
// MAIN PDF GENERATION FUNCTION
// ============================================
exports.generatePDF = async (req, res) => {
    let browser;

    try {
        const userId = req.query.userId;
        const { id } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required"
            });
        }

        console.log(`📄 Generating PDF for product ${id}`);

        // Fetch product with populated items
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

        // Load logo
        let logoBase64 = '';
        const possibleLogoPaths = [
            'public/logo.jpg',
            'src/public/logo.jpg',
            '../public/logo.jpg',
        ];

        for (const logoPath of possibleLogoPaths) {
            try {
                const absolutePath = path.resolve(__dirname, '..', logoPath);
                await fs.access(absolutePath);
                logoBase64 = await toBase64(logoPath);
                if (logoBase64) {
                    console.log('✅ Logo loaded from:', logoPath);
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        // Process items with images
        console.log(`📦 Processing ${product.items?.length || 0} items...`);

        const itemsWithImages = await Promise.all(
            (product.items || []).map(async (itemEntry, index) => {
                const item = itemEntry.item;
                if (!item) return null;

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

                const base64 = item.image ? await toBase64(item.image) : '';

                return {
                    serialNo: index + 1,
                    name: item.name || 'N/A',
                    description: item.description || '',
                    code: item._id?.toString().slice(-8).toUpperCase() || '',
                    rate,
                    qty,
                    amount,
                    base64
                };
            })
        );

        const validItems = itemsWithImages.filter(item => item !== null);
        console.log(`✅ Processed ${validItems.length} valid items`);

        // Calculate totals
        const othersTotal = validItems.reduce((sum, item) => sum + item.amount, 0);
        const totalAmount = othersTotal;
        const netAmount = othersTotal;
        const totalWithoutDiscount = othersTotal / (1 - discountPercent / 100);
        const cgst = includeGst ? (othersTotal * 0.09) : 0;
        const sgst = includeGst ? (othersTotal * 0.09) : 0;
        const totalAmountWithGst = othersTotal + cgst + sgst;
        const roundOff = Math.round(totalAmountWithGst) - totalAmountWithGst;
        const finalAmount = Math.round(totalAmountWithGst);

        const formatCurrency = (value) => value.toFixed(2);
        const formatDate = (date) => new Date(date).toLocaleDateString("en-GB", {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        // Generate all item rows at once
        const generateItemRows = () => validItems.map(item => `
            <tr>
                <td class="text-center">${item.serialNo}</td>
                <td class="text-left">
                    <strong>${item.name}</strong>
                    ${item.description ? `<br><span style="font-size: 9px; color: #666;">${item.description}</span>` : ''}
                </td>
                <td class="text-center">${item.code || '-'}</td>
                <td class="text-center">
                    ${item.base64 ? `<img src="${item.base64}" class="item-image" alt="${item.name}">` : ''}
                </td>
                <td class="text-right">${formatCurrency(item.rate)}</td>
                <td class="text-center">${formatCurrency(item.qty)}</td>
                <td class="text-right">${formatCurrency(discountPercent)}</td>
                <td class="text-right">${formatCurrency(item.amount)}</td>
            </tr>
        `).join('');

        // HTML template (same as before)
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Quotation - ${product.name || 'Customer'}</title>
    <style>
        @page { size: A4; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.3; color: #000; background: white; }
        .no-break { page-break-inside: avoid; }
        .items-section { page-break-inside: auto; }
        .summary-section, .terms-section, .brands-section, .footer { page-break-inside: avoid; }
        .header { border: 2px solid #000; padding: 10px; margin-bottom: 0; page-break-inside: avoid; }
        .header-top { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .logo-section { width: 80px; margin-right: 15px; }
        .logo-box { width: 70px; height: 70px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; background: #f5f5f5; }
        .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .company-info { flex: 1; }
        .company-name { font-size: 18px; font-weight: bold; margin-bottom: 3px; }
        .company-address { font-size: 9px; line-height: 1.3; }
        .header-right { width: 200px; text-align: right; }
        .quotation-title { text-align: center; font-size: 16px; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 0; margin: 10px 0; }
        .header-info { display: flex; justify-content: space-between; }
        .header-left, .header-right-info { width: 48%; }
        .info-line { font-size: 9px; margin-bottom: 3px; }
        .items-section { border-left: 2px solid #000; border-right: 2px solid #000; border-bottom: 2px solid #000; }
        .section-header { background: #f0f0f0; padding: 5px; font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f0f0f0; padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 9px; }
        td { padding: 6px 4px; border: 1px solid #000; vertical-align: middle; font-size: 9px; }
        .text-left { text-align: left; padding-left: 8px; }
        .text-right { text-align: right; padding-right: 8px; }
        .text-center { text-align: center; }
        .item-image { width: 60px; height: 60px; object-fit: contain; display: block; margin: 0 auto; }
        .summary-section { border-left: 2px solid #000; border-right: 2px solid #000; border-bottom: 2px solid #000; padding: 10px; margin-top: 0; }
        .summary-table { width: 100%; margin-bottom: 10px; }
        .summary-table td { padding: 4px 8px; border: 1px solid #000; font-size: 9px; }
        .summary-label { font-weight: bold; background: #f0f0f0; }
        .final-amount-label, .final-amount-value { font-weight: bold; font-size: 11px; padding: 8px; background: #000; color: white; }
        .terms-section { border: 2px solid #000; padding: 10px; margin-top: 10px; }
        .terms-title { font-weight: bold; font-size: 11px; margin-bottom: 8px; text-decoration: underline; }
        .terms-list { font-size: 9px; padding-left: 20px; line-height: 1.5; }
        .terms-list li { margin-bottom: 4px; }
        .brands-section { border-left: 2px solid #000; border-right: 2px solid #000; border-bottom: 2px solid #000; padding: 15px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: center; justify-items: center; }
        .brand-item { text-align: center; font-weight: bold; font-size: 10px; }
        .footer { border-left: 2px solid #000; border-right: 2px solid #000; border-bottom: 2px solid #000; padding: 25px 10px 10px; text-align: right; font-size: 9px; }
        @media print { body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-top">
            <div class="logo-section">
                <div class="logo-box">
                    ${logoBase64 ? `<img src="${logoBase64}" alt="Logo">` : '<span style="font-size: 24px; font-weight: bold;">RT</span>'}
                </div>
            </div>
            <div class="company-info">
                <div class="company-name">Raj TILES</div>
                <div class="company-address">
                    JAL CHHAYA ROW HOUSE, SATELLITE ROAD,<br>
                    PUNA, MOTA VARACHHA<br>
                    Surat Gujarat - 394101<br>
                    98255 32006
                </div>
            </div>
            <div class="header-right">
                <div style="font-size: 10px; margin-bottom: 5px;"><strong>Original</strong></div>
                <div class="info-line"><strong>Quotation No:</strong> ${product._id?.toString().slice(-8).toUpperCase()}</div>
                <div class="info-line"><strong>Date:</strong> ${formatDate(product.date)}</div>
                <div class="info-line"><strong>Validity:</strong> ${formatDate(new Date(product.date).getTime() + 15 * 24 * 60 * 60 * 1000)}</div>
            </div>
        </div>
        <div class="quotation-title">Quotation</div>
        <div class="header-info">
            <div class="header-left">
                <div style="font-weight: bold; margin-bottom: 5px; font-size: 10px;">Buyer (Bill To):</div>
                <div class="info-line"><strong>${product.name || 'CUSTOMER'}</strong></div>
                <div class="info-line">${product.address || 'Surat, Gujarat'}</div>
                <div class="info-line"><strong>State:</strong> Gujarat, Code: 24</div>
                <div class="info-line"><strong>M:</strong> ${product.number || '0000000000'}</div>
            </div>
            <div class="header-right-info">
                <div style="font-weight: bold; margin-bottom: 5px; font-size: 10px;">Consignee (Ship To):</div>
                <div class="info-line"><strong>${product.consigneeName || product.name || 'CUSTOMER'}</strong></div>
                <div class="info-line">${product.consigneeAddress || product.address || 'Surat, Gujarat'}</div>
                <div class="info-line"><strong>State:</strong> Gujarat, Code: 24</div>
                <div class="info-line"><strong>M:</strong> ${product.consigneeMobile || product.number || '0000000000'}</div>
            </div>
        </div>
    </div>
    <div class="items-section">
        <div class="section-header">Items</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 5%;">SR.NO</th>
                    <th style="width: 30%;">DESCRIPTION</th>
                    <th style="width: 10%;">SKU CODE</th>
                    <th style="width: 13%;">IMAGE</th>
                    <th style="width: 10%;">PRICE</th>
                    <th style="width: 10%;">QTY</th>
                    <th style="width: 10%;">DISC%</th>
                    <th style="width: 12%;">AMOUNT</th>
                </tr>
            </thead>
            <tbody>${generateItemRows()}</tbody>
        </table>
    </div>
    <div class="summary-section">
        <table class="summary-table">
            <tr style="border-bottom: 2px solid #000;">
                <td colspan="2" style="border: none; padding: 4px; font-weight: bold;">Total</td>
                <td style="border: none;"></td>
                <td style="border: none; text-align: right; font-weight: bold;">Others + Total Amount</td>
                <td style="border: none; text-align: right; font-weight: bold;">${formatCurrency(othersTotal)}</td>
            </tr>
        </table>
        <table class="summary-table">
            <tr>
                <td class="summary-label" style="width: 30%;">SR. NO.</td>
                <td class="summary-label" style="text-align: center;">AREA</td>
                <td colspan="3" class="summary-label" style="text-align: center;">NET AMOUNT</td>
            </tr>
            <tr>
                <td class="text-center">26</td>
                <td class="text-center">Others</td>
                <td colspan="3" class="text-right">${formatCurrency(othersTotal)}</td>
            </tr>
            <tr>
                <td colspan="2" class="summary-label">Total Amount</td>
                <td colspan="3" class="text-right" style="font-weight: bold;">${formatCurrency(totalAmount)}</td>
            </tr>
            <tr>
                <td colspan="2" class="summary-label">Net Amount</td>
                <td colspan="3" class="text-right" style="font-weight: bold;">${formatCurrency(netAmount)}</td>
            </tr>
            <tr>
                <td colspan="2" class="text-right">Total without Discount:</td>
                <td colspan="3" class="text-right">${formatCurrency(totalWithoutDiscount)}</td>
            </tr>
            ${includeGst ? `
            <tr>
                <td colspan="2" class="text-right">CGST (9%):</td>
                <td colspan="3" class="text-right">${formatCurrency(cgst)}</td>
            </tr>
            <tr>
                <td colspan="2" class="text-right">SGST (9%):</td>
                <td colspan="3" class="text-right">${formatCurrency(sgst)}</td>
            </tr>
            ` : ''}
            <tr>
                <td colspan="2" class="text-right">Total Amount:</td>
                <td colspan="3" class="text-right">${formatCurrency(totalAmountWithGst)}</td>
            </tr>
            <tr>
                <td colspan="2" class="text-right">Round Off:</td>
                <td colspan="3" class="text-right">${formatCurrency(roundOff)}</td>
            </tr>
            <tr>
                <td colspan="2" class="final-amount-label">Final Amount:</td>
                <td colspan="3" class="final-amount-value">${formatCurrency(finalAmount)}</td>
            </tr>
        </table>
        <div style="margin-top: 10px; font-size: 8px;">
            <strong>Amount in words:</strong> ${numberToWords(finalAmount)} Rupees Only
        </div>
        <div style="font-size: 8px; margin-top: 8px; color: #666;">
            Please find below items are also available please contact for further details.
        </div>
    </div>
    <div class="terms-section">
        <div class="terms-title">Terms & Conditions:</div>
        <ul class="terms-list">
            <li>No return policy – Sold goods will not be taken back.</li>
            <li>Free delivery on truckload orders.</li>
            <li>Delivery orders must be placed at least 15 days in advance.</li>
            <li>Only Cash Rate.</li>
        </ul>
    </div>
    <div class="brands-section">
        <div class="brand-item" style="font-style: italic; color: #2d5555;">Jaquar</div>
        <div class="brand-item" style="font-size: 12px;">kerakoll</div>
        <div class="brand-item" style="color: #d32f2f;">Roff<br><span style="font-size: 7px; color: #555;">PREVENT • PROTECT • PRESERVE</span></div>
        <div class="brand-item">
            <div style="width: 40px; height: 40px; border: 2px solid #333; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 18px;">S</span>
            </div>
        </div>
        <div class="brand-item">simola<br><span style="font-size: 7px;">VITRIFIED TILES</span></div>
        <div class="brand-item" style="font-size: 12px;">SEGA<br><span style="font-size: 7px;">TILES</span></div>
        <div class="brand-item" style="background: #1565c0; color: white; padding: 6px 10px; border-radius: 4px; font-size: 9px;">MYK LATICRETE</div>
        <div class="brand-item" style="color: #c89860;">SONARA<br><span style="font-size: 7px;">SANITARY WARES</span></div>
        <div class="brand-item" style="background: #2d2d2d; color: white; padding: 6px 10px; border-radius: 4px;">Wintouch</div>
        <div class="brand-item" style="background: #2d2d2d; color: white; padding: 6px 10px; border-radius: 4px; font-size: 11px;">AGILIS</div>
        <div class="brand-item" style="color: #1a5490; font-size: 12px;">LEMZON<br><span style="font-size: 7px; color: #555;">empire of tiles</span></div>
        <div class="brand-item" style="color: #c62828; font-size: 12px;">LEZORA<br><span style="font-size: 7px; color: #555;">empire of tiles</span></div>
    </div>
    <div class="footer">
        <div style="margin-bottom: 45px; text-align: right;">
            For <strong>RAJ TILES</strong>
        </div>
        <div style="border-top: 1px solid #000; padding-top: 5px; text-align: right;">
            <strong>Authorized Signatory</strong>
        </div>
        <div style="margin-top: 10px; text-align: left; font-size: 8px;">
            <strong>Prepared By:</strong> CHARMI VORA
        </div>
    </div>
</body>
</html>`;

        // ============================================
        // 🔥 LAUNCH BROWSER WITH AUTO-DETECTION
        // ============================================
        console.log("🚀 Launching Puppeteer...");

        const browserConfig = await getBrowserConfig();
        browser = await puppeteer.launch(browserConfig);

        const page = await browser.newPage();

        // Set content with proper waiting
        await page.setContent(html, {
            waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
            timeout: 60000
        });

        // Wait for fonts and rendering
        await page.evaluateHandle('document.fonts.ready');
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log("🎨 Generating PDF...");
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            }
        });

        await browser.close();
        browser = null;

        if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty');
        }

        console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);

        // Send PDF
        const sanitizedName = (product.name || 'Customer').replace(/[^a-z0-9]/gi, '_');
        const filename = `Quotation_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(pdfBuffer, 'binary');

    } catch (error) {
        console.error("❌ PDF generation error:", error);

        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Browser close error:", e);
            }
        }

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "PDF generation failed",
                error: error.message,
                hint: "Make sure Chrome/Chromium is installed. Run: npx puppeteer browsers install chrome"
            });
        }
    }
};
