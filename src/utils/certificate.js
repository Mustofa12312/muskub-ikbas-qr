import jsPDF from 'jspdf';

export const generateCertificate = (participant, eventName) => {
  // A4 Landscape: 297 x 210 mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const width = 297;
  const height = 210;

  // Background Fill (Soft Emerald/Teal tint)
  doc.setFillColor(248, 255, 252);
  doc.rect(0, 0, width, height, 'F');

  // Decorative Border
  doc.setDrawColor(16, 185, 129); // Emerald 500
  doc.setLineWidth(3);
  doc.rect(15, 15, width - 30, height - 30);
  
  // Inner Border
  doc.setDrawColor(200, 215, 210);
  doc.setLineWidth(1);
  doc.rect(18, 18, width - 36, height - 36);

  // Header
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('SERTIFIKAT PENGHARGAAN', width / 2, 50, null, null, 'center');

  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Diberikan secara resmi kepada:', width / 2, 70, null, null, 'center');

  // Participant Name
  doc.setTextColor(16, 185, 129); // Emerald 500
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(participant.name.toUpperCase(), width / 2, 100, null, null, 'center');

  // Body Text
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  
  const bodyText = `Sebagai ${participant.position} dari ${participant.delegation} yang telah\nberpartisipasi secara aktif dalam kegiatan:`;
  doc.text(bodyText, width / 2, 120, null, null, 'center');

  // Event Name
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(eventName.toUpperCase(), width / 2, 145, null, null, 'center');

  // Date Signature Line
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Ditetapkan pada: ${currentDate}`, width / 2, 160, null, null, 'center');

  // Signatures
  doc.text('Ketua Panitia', 70, 180, null, null, 'center');
  doc.setDrawColor(100, 116, 139);
  doc.line(40, 195, 100, 195);
  
  doc.text('Mengetahui', width - 70, 180, null, null, 'center');
  doc.line(width - 100, 195, width - 40, 195);

  doc.save(`Sertifikat_${participant.name.replace(/\s+/g, '_')}.pdf`);
};
