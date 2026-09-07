import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// A4 size in mm: 210 x 297
// ID Card size (B4 landscape equivalent typical for events): 90 x 135 mm (approx)
// We will fit 4 cards per A4 page (2 columns, 2 rows)
const CARD_WIDTH = 90;
const CARD_HEIGHT = 135;
const MARGIN_X = 10;
const MARGIN_Y = 10;
const SPACING_X = 10;
const SPACING_Y = 10;

export const generateIDCards = async (participants, eventName) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let x = MARGIN_X;
  let y = MARGIN_Y;
  let cardsOnPage = 0;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];

    // If page is full (4 cards), add new page
    if (cardsOnPage === 4) {
      doc.addPage();
      x = MARGIN_X;
      y = MARGIN_Y;
      cardsOnPage = 0;
    }

    // Determine position
    const col = cardsOnPage % 2;
    const row = Math.floor(cardsOnPage / 2);
    
    x = MARGIN_X + col * (CARD_WIDTH + SPACING_X);
    y = MARGIN_Y + row * (CARD_HEIGHT + SPACING_Y);

    // Draw Card Border
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 3, 3, 'S');

    // Draw Header Background
    doc.setFillColor(16, 185, 129); // Emerald 500
    // jsPDF doesn't support fill with top-only rounded corners easily, so we draw normal rect inside the rounded one
    // We clip it by just drawing a slightly smaller rect
    doc.rect(x, y, CARD_WIDTH, 30, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('MUSKUB IV', x + CARD_WIDTH / 2, y + 12, null, null, 'center');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('IKBAS PANYEPPEN', x + CARD_WIDTH / 2, y + 20, null, null, 'center');

    // Participant Info
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    
    // Auto scale long names
    let nameSize = 14;
    let nameText = p.name.toUpperCase();
    let textWidth = doc.getStringUnitWidth(nameText) * nameSize / doc.internal.scaleFactor;
    while(textWidth > CARD_WIDTH - 10 && nameSize > 8) {
      nameSize--;
      doc.setFontSize(nameSize);
      textWidth = doc.getStringUnitWidth(nameText) * nameSize / doc.internal.scaleFactor;
    }
    doc.text(nameText, x + CARD_WIDTH / 2, y + 45, null, null, 'center');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(p.delegation, x + CARD_WIDTH / 2, y + 52, null, null, 'center');

    // Position Badge
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.roundedRect(x + CARD_WIDTH / 2 - 20, y + 58, 40, 8, 2, 2, 'F');
    doc.setTextColor(51, 65, 85); // Slate 700
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(p.position.toUpperCase(), x + CARD_WIDTH / 2, y + 63.5, null, null, 'center');

    // Generate QR Code
    if (p.qrCode) {
      try {
        const qrDataUrl = await QRCode.toDataURL(p.qrCode, { margin: 1, scale: 5 });
        doc.addImage(qrDataUrl, 'PNG', x + CARD_WIDTH / 2 - 25, y + 75, 50, 50);
        
        // Print QR text below
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text(p.qrCode, x + CARD_WIDTH / 2, y + 128, null, null, 'center');
      } catch (err) {
        console.error("Failed to generate QR for PDF", err);
      }
    }

    cardsOnPage++;
  }

  doc.save(`ID_Card_Peserta_${eventName.replace(/\s+/g, '_')}.pdf`);
};

export const generateBulkQRCodes = async (participants, eventName) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const QR_SIZE = 40;
  const COLS = 4;
  const ROWS = 6;
  const SPACING_X = (210 - (COLS * QR_SIZE)) / (COLS + 1);
  const SPACING_Y = (297 - (ROWS * (QR_SIZE + 10))) / (ROWS + 1);

  let x = SPACING_X;
  let y = SPACING_Y;
  let itemsOnPage = 0;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];

    if (itemsOnPage === COLS * ROWS) {
      doc.addPage();
      x = SPACING_X;
      y = SPACING_Y;
      itemsOnPage = 0;
    }

    const col = itemsOnPage % COLS;
    const row = Math.floor(itemsOnPage / COLS);
    
    x = SPACING_X + col * (QR_SIZE + SPACING_X);
    y = SPACING_Y + row * (QR_SIZE + 15 + SPACING_Y); // Extra 15 for text

    if (p.qrCode) {
      try {
        const qrDataUrl = await QRCode.toDataURL(p.qrCode, { margin: 1, scale: 5 });
        doc.addImage(qrDataUrl, 'PNG', x, y, QR_SIZE, QR_SIZE);
        
        // Print Name
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        let nameText = p.name;
        if (nameText.length > 20) nameText = nameText.substring(0, 18) + '...';
        doc.text(nameText, x + QR_SIZE / 2, y + QR_SIZE + 4, null, null, 'center');
        
        // Print Delegation
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(p.delegation, x + QR_SIZE / 2, y + QR_SIZE + 8, null, null, 'center');

        // Print Code
        doc.setFontSize(5);
        doc.text(p.qrCode, x + QR_SIZE / 2, y + QR_SIZE + 12, null, null, 'center');

        doc.setDrawColor(226, 232, 240);
        doc.rect(x - 2, y - 2, QR_SIZE + 4, QR_SIZE + 16, 'S');

      } catch (err) {
        console.error("Failed to generate QR for bulk print", err);
      }
    }

    itemsOnPage++;
  }

  doc.save(`Bulk_QR_Codes_${eventName.replace(/\s+/g, '_')}.pdf`);
};
