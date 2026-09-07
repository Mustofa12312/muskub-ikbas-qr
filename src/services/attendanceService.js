import { collection, doc, getDocs, query, where, orderBy, limit, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { mockParticipants } from './participantService';

const PARTICIPANTS_COLLECTION = 'participants';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

export const attendanceService = {
  async processAttendance(qrCode, eventId) {
    if (!qrCode || !eventId) throw new Error('QR Code atau Event ID tidak valid');

    if (isMockMode) {
      const idx = mockParticipants.findIndex(p => p.qrCode === qrCode && p.eventId === eventId);
      if (idx === -1) {
        return { success: false, status: 'NOT_FOUND', message: 'QR Code tidak dikenali' };
      }

      const participant = mockParticipants[idx];
      if (participant.status === 'HADIR') {
        return {
          success: false,
          status: 'ALREADY_ATTENDED',
          message: 'Peserta sudah melakukan absensi',
          participant: { ...participant }
        };
      }

      const now = new Date();
      const updateData = {
        status: 'HADIR',
        attendanceDate: now.toISOString().split('T')[0],
        attendanceTime: now.toTimeString().split(' ')[0],
        attendanceTimestamp: now.getTime()
      };

      mockParticipants[idx] = { ...participant, ...updateData };

      return {
        success: true,
        status: 'SUCCESS',
        participant: { ...mockParticipants[idx] }
      };
    }

    try {
      const result = await runTransaction(db, async (transaction) => {
        const q = query(
          collection(db, PARTICIPANTS_COLLECTION),
          where('qrCode', '==', qrCode),
          where('eventId', '==', eventId)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          return { success: false, status: 'NOT_FOUND', message: 'QR Code tidak dikenali' };
        }

        const participantDoc = snapshot.docs[0];
        const participantData = participantDoc.data();
        const docRef = doc(db, PARTICIPANTS_COLLECTION, participantDoc.id);

        if (participantData.status === 'HADIR') {
          return {
            success: false,
            status: 'ALREADY_ATTENDED',
            message: 'Peserta sudah melakukan absensi',
            participant: { id: participantDoc.id, ...participantData }
          };
        }

        const now = new Date();
        const updateData = {
          status: 'HADIR',
          attendanceDate: now.toISOString().split('T')[0],
          attendanceTime: now.toTimeString().split(' ')[0],
          attendanceTimestamp: now.getTime()
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

  async getRecentScans(eventId, limitCount = 5) {
    if (isMockMode) {
      return mockParticipants
        .filter(p => p.eventId === eventId && p.status === 'HADIR')
        .sort((a, b) => (b.attendanceTimestamp || 0) - (a.attendanceTimestamp || 0))
        .slice(0, limitCount);
    }

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
  
  async getAttendanceStats(eventId) {
    if (isMockMode) {
      const eventParticipants = mockParticipants.filter(p => p.eventId === eventId);
      const total = eventParticipants.length;
      const present = eventParticipants.filter(p => p.status === 'HADIR').length;
      
      return {
        total,
        present,
        absent: total - present,
        percentage: total === 0 ? 0 : Math.round((present / total) * 100)
      };
    }

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
