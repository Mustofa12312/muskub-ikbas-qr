import { collection, doc, getDocs, query, where, orderBy, limit, runTransaction, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { mockParticipants } from './participantService';

const PARTICIPANTS_COLLECTION = 'participants';
const ATTENDANCE_COLLECTION = 'attendance';
const ATTENDANCE_LOGS_COLLECTION = 'attendanceLogs';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

export const attendanceService = {
  async processAttendance(qrCode, eventId, action = 'in', sessionId = null, scannerId = 'Unknown') {
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

      const result = await runTransaction(db, async (transaction) => {
        // Read participant doc again to be safe
        const pDoc = await transaction.get(docRef);
        if (!pDoc.exists()) {
          throw new Error("Document does not exist!");
        }

        const participantData = pDoc.data();
        
        // Use a composite ID for attendance document
        const actualSessionId = sessionId || 'main';
        const attendanceDocId = `${eventId}_${actualSessionId}_${participantDocRef.id}`;
        const attendanceRef = doc(db, ATTENDANCE_COLLECTION, attendanceDocId);
        
        const aDoc = await transaction.get(attendanceRef);
        const currentStatus = aDoc.exists() ? aDoc.data().status : 'BELUM HADIR';
        
        let updateData = {};

        if (action === 'in') {
          if (currentStatus === 'HADIR') {
            return {
              success: false,
              status: 'ALREADY_ATTENDED',
              message: 'Peserta sudah melakukan Check-in',
              participant: { id: pDoc.id, ...participantData }
            };
          }

          updateData = {
            eventId,
            sessionId: actualSessionId,
            participantId: pDoc.id,
            status: 'HADIR',
            attendanceDate: localDateStr,
            attendanceTime: localTimeStr,
            attendanceTimestamp: serverTimestamp()
          };
        } else if (action === 'out') {
          if (currentStatus !== 'HADIR') {
            return {
              success: false,
              status: 'ERROR',
              message: 'Peserta belum Check-in, tidak bisa Check-out',
              participant: { id: pDoc.id, ...participantData }
            };
          }
          if (aDoc.exists() && aDoc.data().checkoutTime) {
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

        if (aDoc.exists()) {
          transaction.update(attendanceRef, updateData);
        } else {
          transaction.set(attendanceRef, updateData);
        }

        // Write to attendanceLogs
        const logRef = doc(collection(db, ATTENDANCE_LOGS_COLLECTION));
        transaction.set(logRef, {
          eventId,
          sessionId: actualSessionId,
          participantId: pDoc.id,
          action,
          scannerId,
          timestamp: serverTimestamp()
        });

        // For the UI return object, approximate serverTimestamp
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

  async overrideAttendanceStatus(eventId, participantId, newStatus, reason, sessionId = 'main') {
    if (isMockMode) return; // Not fully supported in mock mode

    try {
      const now = new Date();
      const localDateStr = now.toISOString().split('T')[0];
      const localTimeStr = now.toTimeString().split(' ')[0];

      await runTransaction(db, async (transaction) => {
        const attendanceDocId = `${eventId}_${sessionId}_${participantId}`;
        const attendanceRef = doc(db, ATTENDANCE_COLLECTION, attendanceDocId);
        
        let updateData = {
          eventId,
          sessionId,
          participantId,
          status: newStatus
        };

        if (newStatus === 'HADIR') {
          updateData.attendanceDate = localDateStr;
          updateData.attendanceTime = localTimeStr;
          updateData.attendanceTimestamp = serverTimestamp();
        } else {
          // If overriding to BELUM HADIR, we can clear the times or just keep them but change status
          updateData.attendanceDate = null;
          updateData.attendanceTime = null;
          updateData.attendanceTimestamp = null;
        }

        const aDoc = await transaction.get(attendanceRef);
        if (aDoc.exists()) {
          transaction.update(attendanceRef, updateData);
        } else {
          transaction.set(attendanceRef, updateData);
        }

        // Create an Audit Log for this manual override
        const auditLogRef = doc(collection(db, 'auditLogs'));
        transaction.set(auditLogRef, {
          action: 'MANUAL_OVERRIDE',
          module: 'ATTENDANCE',
          eventId,
          participantId,
          details: `Diubah menjadi ${newStatus}. Alasan: ${reason}`,
          timestamp: serverTimestamp()
        });
      });
    } catch (error) {
      console.error("Error overriding attendance: ", error);
      throw new Error('Gagal melakukan koreksi absensi');
    }
  },

  async getAttendanceLogs(eventId, sessionId = null) {
    if (isMockMode) return []; // Mock doesn't store robust logs

    const conditions = [where('eventId', '==', eventId)];
    if (sessionId) {
      conditions.push(where('sessionId', '==', sessionId));
    }

    const q = query(
      collection(db, ATTENDANCE_LOGS_COLLECTION),
      ...conditions,
      orderBy('timestamp', 'desc'),
      limit(200) // Limit to last 200 logs for performance
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];

    // Fetch participant data to display names
    const pQ = query(collection(db, PARTICIPANTS_COLLECTION), where('eventId', '==', eventId));
    const pSnapshot = await getDocs(pQ);
    const pMap = {};
    pSnapshot.forEach(doc => {
      pMap[doc.id] = doc.data();
    });

    return snapshot.docs.map(doc => {
      const data = doc.data();
      const p = pMap[data.participantId];
      return {
        id: doc.id,
        ...data,
        participantName: p?.name || 'Unknown',
        delegation: p?.delegation || 'Unknown'
      };
    });
  },

  async getRecentScans(eventId, limitCount = 5, sessionId = null) {
    if (isMockMode) {
      return mockParticipants
        .filter(p => p.eventId === eventId && p.status === 'HADIR')
        .sort((a, b) => (b.attendanceTimestamp || 0) - (a.attendanceTimestamp || 0))
        .slice(0, limitCount);
    }

    const conditions = [
      where('eventId', '==', eventId),
      where('status', '==', 'HADIR')
    ];
    if (sessionId) {
      conditions.push(where('sessionId', '==', sessionId));
    }

    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      ...conditions,
      orderBy('attendanceTimestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return [];

    // Fetch participant data for each recent scan
    const recentData = [];
    for (const docSnap of snapshot.docs) {
      const aData = docSnap.data();
      const pDoc = await getDoc(doc(db, PARTICIPANTS_COLLECTION, aData.participantId));
      if (pDoc.exists()) {
        const timestamp = aData.attendanceTimestamp?.toDate ? aData.attendanceTimestamp.toDate().getTime() : 0;
        recentData.push({ id: aData.participantId, ...pDoc.data(), ...aData, attendanceTimestamp: timestamp });
      }
    }
    return recentData;
  },
  
  async getAttendanceStats(eventId, sessionId = null) {
    if (isMockMode) {
      const eventParticipants = mockParticipants.filter(p => p.eventId === eventId);
      const total = eventParticipants.length;
      const present = eventParticipants.filter(p => p.status === 'HADIR').length;
      return { total, present, absent: total - present, percentage: total === 0 ? 0 : Math.round((present / total) * 100) };
    }

    const pQ = query(collection(db, PARTICIPANTS_COLLECTION), where('eventId', '==', eventId));
    const pSnapshot = await getDocs(pQ);
    const total = pSnapshot.size;
    
    const conditions = [
      where('eventId', '==', eventId),
      where('status', '==', 'HADIR')
    ];
    if (sessionId) {
      conditions.push(where('sessionId', '==', sessionId));
    }

    const aQ = query(collection(db, ATTENDANCE_COLLECTION), ...conditions);
    const aSnapshot = await getDocs(aQ);
    const present = aSnapshot.size;
    
    return {
      total,
      present,
      absent: total - present,
      percentage: total === 0 ? 0 : Math.round((present / total) * 100)
    };
  },
  
  subscribeToDashboardData(eventId, callback, sessionId = null) {
    if (isMockMode) {
      const getMockData = () => {
        const eventParticipants = mockParticipants.filter(p => p.eventId === eventId);
        const total = eventParticipants.length;
        const present = eventParticipants.filter(p => p.status === 'HADIR').length;
        const stats = { total, present, absent: total - present, percentage: total === 0 ? 0 : Math.round((present / total) * 100) };
        const allPresent = eventParticipants.filter(p => p.status === 'HADIR');
        const recent = [...allPresent].sort((a, b) => (b.attendanceTimestamp || 0) - (a.attendanceTimestamp || 0)).slice(0, 5);
        callback(stats, recent, allPresent, eventParticipants);
      };
      
      getMockData();
      const interval = setInterval(getMockData, 5000);
      return () => clearInterval(interval);
    }

    let unsubscribe = () => {};
    let isUnsubscribed = false;

    // First fetch all participants to have a local map for joining data
    const pQ = query(collection(db, PARTICIPANTS_COLLECTION), where('eventId', '==', eventId));
    getDocs(pQ).then(pSnapshot => {
      if (isUnsubscribed) return;

      const pMap = {};
      pSnapshot.forEach(doc => {
        pMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      const total = pSnapshot.size;

      const actualSessionId = sessionId || 'main';
      const aQ = query(
        collection(db, ATTENDANCE_COLLECTION),
        where('eventId', '==', eventId),
        where('sessionId', '==', actualSessionId)
      );

      unsubscribe = onSnapshot(aQ, (aSnapshot) => {
        if (isUnsubscribed) return;

        let present = 0;
        const allPresent = [];

        aSnapshot.forEach(doc => {
          const aData = doc.data();
          if (aData.status === 'HADIR') {
            present++;
            if (pMap[aData.participantId]) {
              allPresent.push({
                ...pMap[aData.participantId],
                ...aData,
                // Ensure timestamp is comparable for sorting
                sortTime: aData.attendanceTimestamp?.toMillis ? aData.attendanceTimestamp.toMillis() : 0
              });
            }
          }
        });

        const stats = {
          total,
          present,
          absent: total - present,
          percentage: total === 0 ? 0 : Math.round((present / total) * 100)
        };

        const recent = [...allPresent]
          .sort((a, b) => b.sortTime - a.sortTime)
          .slice(0, 5);

        const allParticipants = Object.values(pMap);

        callback(stats, recent, allPresent, allParticipants);
      }, (error) => {
        console.error("Error subscribing to dashboard data: ", error);
      });
    }).catch(err => console.error("Error fetching participants for dashboard:", err));

    return () => {
      isUnsubscribed = true;
      unsubscribe();
    };
  }
};
