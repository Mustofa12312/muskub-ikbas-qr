import { collection, doc, getDocs, query, where, orderBy, limit, runTransaction, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { mockParticipants } from './participantService';

const PARTICIPANTS_COLLECTION = 'participants';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

export const attendanceService = {
  async processAttendance(qrCode, eventId, action = 'in', sessionId = null) {
    if (!qrCode || !eventId) throw new Error('QR Code atau Event ID tidak valid');

    if (isMockMode) {
      const idx = mockParticipants.findIndex(p => p.qrCode === qrCode && p.eventId === eventId);
      if (idx === -1) {
        return { success: false, status: 'NOT_FOUND', message: 'QR Code tidak dikenali' };
      }

      const participant = mockParticipants[idx];
      const now = new Date();
      
      // Multi-session logic
      const targetSession = sessionId ? (participant.sessionData?.[sessionId] || {}) : participant;
      
      if (action === 'in') {
        if (targetSession.status === 'HADIR') {
          return {
            success: false,
            status: 'ALREADY_ATTENDED',
            message: 'Peserta sudah melakukan Check-in',
            participant: { ...participant }
          };
        }

        const updateData = {
          status: 'HADIR',
          attendanceDate: now.toISOString().split('T')[0],
          attendanceTime: now.toTimeString().split(' ')[0],
          attendanceTimestamp: now.getTime()
        };

        if (sessionId) {
          mockParticipants[idx] = { 
            ...participant, 
            sessionData: { 
              ...(participant.sessionData || {}), 
              [sessionId]: { ...targetSession, ...updateData } 
            }
          };
        } else {
          mockParticipants[idx] = { ...participant, ...updateData };
        }

      } else if (action === 'out') {
        if (targetSession.status !== 'HADIR') {
          return {
            success: false,
            status: 'ERROR',
            message: 'Peserta belum Check-in, tidak bisa Check-out',
            participant: { ...participant }
          };
        }
        if (targetSession.checkoutTime) {
          return {
            success: false,
            status: 'ALREADY_ATTENDED',
            message: 'Peserta sudah melakukan Check-out sebelumnya',
            participant: { ...participant }
          };
        }

        const updateData = {
          checkoutTime: now.toTimeString().split(' ')[0],
          checkoutTimestamp: now.getTime()
        };

        if (sessionId) {
          mockParticipants[idx] = { 
            ...participant, 
            sessionData: { 
              ...(participant.sessionData || {}), 
              [sessionId]: { ...targetSession, ...updateData } 
            }
          };
        } else {
          mockParticipants[idx] = { ...participant, ...updateData };
        }
      }

      return {
        success: true,
        status: 'SUCCESS',
        participant: { ...mockParticipants[idx] },
        action,
        sessionId
      };
    }

    try {
      // 1. Query outside transaction to find docId
      const q = query(
        collection(db, PARTICIPANTS_COLLECTION),
        where('qrCode', '==', qrCode),
        where('eventId', '==', eventId)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { success: false, status: 'NOT_FOUND', message: 'QR Code tidak dikenali' };
      }

      const participantDocRef = snapshot.docs[0];
      const docRef = doc(db, PARTICIPANTS_COLLECTION, participantDocRef.id);
      
      const now = new Date(); // Still need local time for UI display strings
      const localDateStr = now.toISOString().split('T')[0];
      const localTimeStr = now.toTimeString().split(' ')[0];

      // 2. Run transaction with the docRef
      const result = await runTransaction(db, async (transaction) => {
        const pDoc = await transaction.get(docRef);
        if (!pDoc.exists()) {
          throw new Error("Document does not exist!");
        }

        const participantData = pDoc.data();
        const targetSession = sessionId ? (participantData.sessionData?.[sessionId] || {}) : participantData;
        let updateData = {};

        if (action === 'in') {
          if (targetSession.status === 'HADIR') {
            return {
              success: false,
              status: 'ALREADY_ATTENDED',
              message: 'Peserta sudah melakukan Check-in',
              participant: { id: pDoc.id, ...participantData }
            };
          }

          updateData = {
            status: 'HADIR',
            attendanceDate: localDateStr,
            attendanceTime: localTimeStr,
            attendanceTimestamp: serverTimestamp() // Use server time for accurate sorting
          };
        } else if (action === 'out') {
          if (targetSession.status !== 'HADIR') {
            return {
              success: false,
              status: 'ERROR',
              message: 'Peserta belum Check-in, tidak bisa Check-out',
              participant: { id: pDoc.id, ...participantData }
            };
          }
          if (targetSession.checkoutTime) {
            return {
              success: false,
              status: 'ALREADY_ATTENDED',
              message: 'Peserta sudah melakukan Check-out',
              participant: { id: pDoc.id, ...participantData }
            };
          }

          updateData = {
            checkoutTime: localTimeStr,
            checkoutTimestamp: serverTimestamp()
          };
        }

        let finalUpdate = updateData;
        if (sessionId) {
          finalUpdate = {
            [`sessionData.${sessionId}.status`]: updateData.status || targetSession.status,
            [`sessionData.${sessionId}.attendanceTime`]: updateData.attendanceTime || targetSession.attendanceTime,
            [`sessionData.${sessionId}.checkoutTime`]: updateData.checkoutTime || targetSession.checkoutTime,
            [`sessionData.${sessionId}.attendanceTimestamp`]: updateData.attendanceTimestamp || targetSession.attendanceTimestamp,
            [`sessionData.${sessionId}.checkoutTimestamp`]: updateData.checkoutTimestamp || targetSession.checkoutTimestamp
          };
        }

        transaction.update(docRef, finalUpdate);

        // For the UI return object, replace serverTimestamp() with local time approximation
        const returnedUpdateData = { ...updateData };
        if (returnedUpdateData.attendanceTimestamp) returnedUpdateData.attendanceTimestamp = now.getTime();
        if (returnedUpdateData.checkoutTimestamp) returnedUpdateData.checkoutTimestamp = now.getTime();

        return {
          success: true,
          status: 'SUCCESS',
          participant: { id: pDoc.id, ...participantData, ...returnedUpdateData },
          action,
          sessionId
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
  },
  
  subscribeToDashboardData(eventId, callback) {
    if (isMockMode) {
      // For mock mode, just return static data periodically or once
      const getMockData = () => {
        const eventParticipants = mockParticipants.filter(p => p.eventId === eventId);
        const total = eventParticipants.length;
        const present = eventParticipants.filter(p => p.status === 'HADIR').length;
        
        const stats = {
          total,
          present,
          absent: total - present,
          percentage: total === 0 ? 0 : Math.round((present / total) * 100)
        };
        
        const recent = eventParticipants
          .filter(p => p.status === 'HADIR')
          .sort((a, b) => (b.attendanceTimestamp || 0) - (a.attendanceTimestamp || 0))
          .slice(0, 5);
          
        const allPresent = eventParticipants.filter(p => p.status === 'HADIR');
        
        callback(stats, recent, allPresent);
      };
      
      getMockData();
      const interval = setInterval(getMockData, 5000);
      return () => clearInterval(interval); // return unsubscribe function
    }

    const q = query(
      collection(db, PARTICIPANTS_COLLECTION),
      where('eventId', '==', eventId)
    );

    // This listener will fire whenever data changes
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allParticipants = [];
      let total = snapshot.size;
      let present = 0;

      snapshot.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        allParticipants.push(data);
        if (data.status === 'HADIR') present++;
      });

      const stats = {
        total,
        present,
        absent: total - present,
        percentage: total === 0 ? 0 : Math.round((present / total) * 100)
      };

      // Get recent 5
      const recent = allParticipants
        .filter(p => p.status === 'HADIR')
        .sort((a, b) => (b.attendanceTimestamp || 0) - (a.attendanceTimestamp || 0))
        .slice(0, 5);

      const allPresent = allParticipants.filter(p => p.status === 'HADIR');

      callback(stats, recent, allPresent);
    }, (error) => {
      console.error("Error subscribing to dashboard data: ", error);
    });

    return unsubscribe;
  }
};
