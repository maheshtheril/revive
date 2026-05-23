const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

try {
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, 'test.pdf');
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    doc.fontSize(24).text('Ziona HMS Test PDF', 100, 100);
    doc.end();
    
    stream.on('finish', () => {
        console.log('PDF written successfully to ' + pdfPath);
    });
} catch (e) {
    console.error('Error generating PDF:', e);
}
