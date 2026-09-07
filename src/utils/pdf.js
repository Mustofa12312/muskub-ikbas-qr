import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportToPDF = (participants, eventName, stats) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MUSKUB IV', 105, 15, null, null, 'center');
  
  doc.setFontSize(12);
  doc.text('IKBAS PANYEPPEN', 105, 22, null, null, 'center');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('DAFTAR KEHADIRAN PESERTA', 105, 32, null, null, 'center');
  doc.text(eventName, 105, 39, null, null, 'center');

  // Stats Info
  doc.setFontSize(10);
  doc.text(`Total Peserta: ${stats.total}`, 14, 50);
  doc.text(`Hadir: ${stats.present}`, 14, 56);
  doc.text(`Belum Hadir: ${stats.absent}`, 14, 62);
  doc.text(`Persentase: ${stats.percentage}%`, 14, 68);

  // Generate Table Data
  const tableData = participants.map((p, index) => [
    index + 1,
    p.name,
    p.delegation,
    p.position,
    p.status,
    p.status === 'HADIR' ? p.attendanceTime : '-'
  ]);

  // Render Table
  doc.autoTable({
    startY: 75,
    head: [['No', 'Nama', 'Delegasi', 'Jabatan', 'Status', 'Jam']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
    styles: { fontSize: 9 },
  });

  // Save PDF
  doc.save(`Laporan_Absensi_${eventName.replace(/\s+/g, '_')}.pdf`);
};
