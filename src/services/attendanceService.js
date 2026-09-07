import { collection, doc, getDocs, updateDoc, query, where, orderBy, limit, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

const PARTICIPANTS_COLLECTION = 'participants';

export const attendanceService = {
  // Melakukan absen berdasarkan QR Code
  async processAttendance(qrCode, eventId) {
    if (!qrCode || !eventId) throw new Error('QR Code atau Event ID tidak valid');

    try {
      // Gunakan Transaction untuk mencegah double scan secara bersamaan (race condition)
      const result = await runTransaction(db, async (transaction) => {
        // 1. Cari peserta berdasarkan QR
        const q = query(
          collection(db, PARTICIPANTS_COLLECTION),
          where('qrCode', '==', qrCode),
          where('eventId', '==', eventId)
        );
        
        // Catatan: runTransaction dengan query perlu menggunakan getDocs biasa di luar/dalam jika strukturnya rumit.
        // Di sini kita ambil dulu document referencenya:
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          return { success: false, status: 'NOT_FOUND', message: 'QR Code tidak dikenali' };
        }

        const participantDoc = snapshot.docs[0];
        const participantData = participantDoc.data();
        const docRef = doc(db, PARTICIPANTS_COLLECTION, participantDoc.id);

        // 2. Cek apakah sudah hadir
        if (participantData.status === 'HADIR') {
          return {
            success: false,
            status: 'ALREADY_ATTENDED',
            message: 'Peserta sudah melakukan absensi',
            participant: { id: participantDoc.id, ...participantData }
          };
        }

        // 3. Update status jadi HADIR
        const now = new Date();
        const updateData = {
          status: 'HADIR',
          attendanceDate: now.toISOString().split('T')[0], // YYYY-MM-DD
          attendanceTime: now.toTimeString().split(' ')[0], // HH:MM:SS
          attendanceTimestamp: now.getTime() // untuk sorting
        };

        transaction.update(docRef, updateData);

        return {
          success: true,
          status: 'SUCCESS',
          participant: { id: participantDoc.id, ...participantData, ...updateData }
        };
      });

      return result;
    } catch (error) {
      console.error("Error processing attendance: ", error);
      throw new Error('Gagal memproses absensi');
    }
  },

  // Mendapatkan scan terbaru (Recent Scans)
  async getRecentScans(eventId, limitCount = 5) {
    const q = query(
      collection(db, PARTICIPANTS_COLLECTION),
      where('eventId', '==', eventId),
      where('status', '==', 'HADIR'),
      orderBy('attendanceTimestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  
  // Statistik kehadiran
  async getAttendanceStats(eventId) {
    // Note: Untuk production dengan ribuan data, lebih baik menggunakan fungsi Agregasi Firestore (count)
    // Di sini kita fetch semua dan hitung di client, atau bisa di-split.
    const q = query(
      collection(db, PARTICIPANTS_COLLECTION),
      where('eventId', '==', eventId)
    );
    const snapshot = await getDocs(q);
    
    let total = snapshot.size;
    let present = 0;
    
    snapshot.forEach(doc => {
      if (doc.data().status === 'HADIR') present++;
    });
    
    return {
      total,
      present,
      absent: total - present,
      percentage: total === 0 ? 0 : Math.round((present / total) * 100)
    };
  }
};
