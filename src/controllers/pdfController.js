

const Product = require("../models/Product");
const PDFDocument = require("pdfkit");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");

// ============================================
// HELPER: Convert image to buffer
// ============================================
const getImageBuffer = async (imagePathOrUrl) => {
    try {
        if (!imagePathOrUrl.startsWith('http')) {
            const absolutePath = path.resolve(__dirname, '..', imagePathOrUrl.replace(/^\//, ''));
            try {
                await fs.access(absolutePath);
                return await fs.readFile(absolutePath);
            } catch (err) {
                console.error('Local image not found:', absolutePath);
                return null;
            }
        }

        const response = await fetch(imagePathOrUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) return null;
        return await response.buffer();

    } catch (error) {
        console.error('Image fetch error:', error.message);
        return null;
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

        console.log(`📄 Generating PDF for product ${id}`);

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

        // Load logo
        let logoBuffer = null;
        const possibleLogoPaths = [
            'public/logo.jpg',
            'src/public/logo.jpg',
            '../public/logo.jpg',
        ];

        for (const logoPath of possibleLogoPaths) {
            try {
                const absolutePath = path.resolve(__dirname, '..', logoPath);
                await fs.access(absolutePath);
                logoBuffer = await getImageBuffer(logoPath);
                if (logoBuffer) {
                    console.log('✅ Logo loaded from:', logoPath);
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        // Process items
        console.log(`📦 Processing ${product.items?.length || 0} items...`);

        const processedItems = await Promise.all(
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

                const imageBuffer = item.image ? await getImageBuffer(item.image) : null;

                return {
                    serialNo: index + 1,
                    name: item.name || 'N/A',
                    description: item.description || '',
                    code: item._id?.toString().slice(-8).toUpperCase() || '',
                    rate,
                    qty,
                    amount,
                    imageBuffer
                };
            })
        );

        const validItems = processedItems.filter(item => item !== null);
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

        // ============================================
        // CREATE PDF WITH PDFKIT
        // ============================================
        const doc = new PDFDocument({
            size: 'A4',
            margin: 30,
            bufferPages: true
        });

        // Collect PDF data in buffer
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            const sanitizedName = (product.name || 'Customer').replace(/[^a-z0-9]/gi, '_');
            const filename = `Quotation_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.end(pdfBuffer);
        });

        // Start drawing PDF
        let y = 40;

        // ============================================
        // HEADER SECTION
        // ============================================
        doc.rect(30, 30, 535, 140).stroke();

        // Logo
        if (logoBuffer) {
            try {
                doc.image(logoBuffer, 40, 40, { width: 60, height: 60 });
            } catch (err) {
                console.error('Logo image error:', err);
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
        for (const item of validItems) {
            const rowHeight = 70; // Fixed height for image rows

            // Check if we need a new page
            if (y + rowHeight > 750) {
                doc.addPage();
                y = 40;
            }

            doc.rect(30, y, 535, rowHeight).stroke();

            // Draw vertical lines
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
            if (item.imageBuffer) {
                try {
                    doc.image(item.imageBuffer, colX[3] + 5, y + 5, { width: 60, height: 60, fit: [60, 60] });
                } catch (err) {
                    console.error('Item image error:', err);
                }
            }

            // Price, Qty, Disc, Amount
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
        doc.text('Others + Total Amount', 300, y);  // Better spacing
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
        // BRANDS SECTION
        // ============================================
        y += 70;
        if (y > 680) {
            doc.addPage();
            y = 40;
        }

        const brands = ['Jaquar', 'kerakoll', 'Roff', 'S', 'simola', 'SEGA', 'MYK LATICRETE', 'SONARA', 'Wintouch', 'AGILIS', 'LEMZON', 'LEZORA'];
        doc.rect(30, y, 535, 80).stroke();

        const brandCols = 4;
        const brandWidth = 535 / brandCols;
        const brandHeight = 80 / 3;

        brands.forEach((brand, i) => {
            const col = i % brandCols;
            const row = Math.floor(i / brandCols);
            const bx = 30 + col * brandWidth;
            const by = y + row * brandHeight;

            doc.fontSize(9).font('Helvetica-Bold').text(brand, bx, by + 10, { width: brandWidth, align: 'center' });
        });

        // ============================================
        // FOOTER
        // ============================================
        y += 90;
        doc.rect(30, y, 535, 80).stroke();
        doc.fontSize(8).font('Helvetica');
        doc.text('For', 480, y + 10);
        doc.font('Helvetica-Bold').text('RAJ TILES', 480, y + 22);

        doc.moveTo(450, y + 55).lineTo(555, y + 55).stroke();
        doc.text('Authorized Signatory', 450, y + 58, { width: 105, align: 'center' });

        doc.fontSize(7).font('Helvetica-Bold').text('Prepared By:', 40, y + 65);
        doc.font('Helvetica').text('CHARMI VORA', 90, y + 65);

        doc.end();

    } catch (error) {
        console.error("❌ PDF generation error:", error);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "PDF generation failed",
                error: error.message
            });
        }
    }
};
