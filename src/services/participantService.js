import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { auditService } from './auditService';
import { compressImageToBase64 } from '../utils/imageUtils';

const PARTICIPANTS_COLLECTION = 'participants';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

let mockParticipants = [
  { id: 'p1', name: 'Ahmad Dahlan', mpw: 'Jawa Timur', mpc: 'Pamekasan', position: 'Ketua', qrCode: 'MUSKUB4-PST-p1' },
  { id: 'p2', name: 'Siti Aminah', mpw: 'Jawa Timur', mpc: 'Sampang', position: 'Anggota', qrCode: 'MUSKUB4-PST-p2' },
];

export const participantService = {
  async getAllParticipants() {
    if (isMockMode) {
      return mockParticipants
        .filter(p => !p.isDeleted)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const q = query(
      collection(db, PARTICIPANTS_COLLECTION),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => !p.isDeleted);
  },

  async createParticipant(participantData, photoFile) {
    let photoUrl = '';
    const { eventId, ...dataToSave } = participantData;
    
    if (isMockMode) {
      const id = Math.random().toString(36).substr(2, 9);
      const qrCode = dataToSave.qrCode || `MUSKUB4-PST-${id}`;
      const newParticipant = {
        ...dataToSave,
        id,
        photoUrl: '',
        qrCode,
        createdAt: new Date().toISOString()
      };
      mockParticipants.push(newParticipant);
      auditService.logAction('CREATE', 'Peserta', `Mendaftarkan peserta baru: ${dataToSave.name}`);
      return newParticipant;
    }

    if (dataToSave.qrCode) {
      const q = query(
        collection(db, PARTICIPANTS_COLLECTION),
        where('qrCode', '==', dataToSave.qrCode)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        throw new Error('QR Code sudah digunakan oleh peserta lain di acara ini.');
      }
    }

    // Compress photo to Base64 and store directly in Firestore
    if (photoFile) {
      photoUrl = await compressImageToBase64(photoFile);
    }

    const newParticipant = {
      ...dataToSave,
      photoUrl,
      qrCode: dataToSave.qrCode || '',
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipant);
    
    const qrCode = dataToSave.qrCode || `MUSKUB4-PST-${docRef.id}`;
    if (!dataToSave.qrCode) {
      await updateDoc(docRef, { qrCode });
    }
    
    newParticipant.qrCode = qrCode;

    auditService.logAction('CREATE', 'Peserta', `Mendaftarkan peserta baru: ${dataToSave.name}`);
    return { id: docRef.id, ...newParticipant, qrCode };
  },

  async createBulkParticipants(participantsList) {
    if (isMockMode) {
      const newParticipants = participantsList.map(p => {
        const id = Math.random().toString(36).substr(2, 9);
        return {
          ...p,
          id,
          photoUrl: '',
          qrCode: p.qrCode || `MUSKUB4-PST-${id}`,
          createdAt: new Date().toISOString()
        };
      });
      mockParticipants.push(...newParticipants);
      auditService.logAction('CREATE_BULK', 'Peserta', `Mendaftarkan ${newParticipants.length} peserta baru`);
      return { successCount: newParticipants.length, errorCount: 0 };
    }

    // Ambil daftar QR Code dan Profil yang sudah ada untuk mencegah duplikasi
    const snapshot = await getDocs(collection(db, PARTICIPANTS_COLLECTION));
    const existingQRCodes = new Set();
    const existingProfiles = new Set();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.qrCode) existingQRCodes.add(data.qrCode);
      if (data.name && data.mpw && data.mpc) {
        const profileKey = `${data.name.toLowerCase().trim()}|${data.mpw.toLowerCase().trim()}|${data.mpc.toLowerCase().trim()}`;
        existingProfiles.add(profileKey);
      }
    });

    // Validasi data baru
    const validParticipants = [];
    const newQRs = new Set();
    const newProfiles = new Set();
    let errorCount = 0;

    for (const p of participantsList) {
      let isDuplicate = false;
      
      // 1. Cek Duplikat QR
      if (p.qrCode && (existingQRCodes.has(p.qrCode) || newQRs.has(p.qrCode))) {
        isDuplicate = true;
      }
      
      // 2. Cek Duplikat Profil (Nama + MPW + MPC)
      if (p.name && p.mpw && p.mpc) {
        const profileKey = `${p.name.toLowerCase().trim()}|${p.mpw.toLowerCase().trim()}|${p.mpc.toLowerCase().trim()}`;
        if (existingProfiles.has(profileKey) || newProfiles.has(profileKey)) {
          isDuplicate = true;
        } else if (!isDuplicate) {
          newProfiles.add(profileKey);
        }
      }

      if (isDuplicate) {
        errorCount++;
        continue;
      }

      if (p.qrCode) newQRs.add(p.qrCode);
      validParticipants.push(p);
    }

    if (validParticipants.length === 0) {
      return { successCount: 0, errorCount: participantsList.length };
    }

    // Eksekusi Batch (Batas Firestore Batch adalah 500)
    let batch = writeBatch(db);
    let operationCounter = 0;
    
    for (const p of validParticipants) {
      const docRef = doc(collection(db, PARTICIPANTS_COLLECTION));
      const qrCode = p.qrCode || `MUSKUB4-PST-${docRef.id}`;
      
      const newParticipant = {
        name: p.name,
        mpw: p.mpw,
        mpc: p.mpc,
        position: p.position,
        photoUrl: '',
        qrCode,
        createdAt: new Date().toISOString()
      };
      
      batch.set(docRef, newParticipant);
      operationCounter++;

      if (operationCounter === 490) { // Limit aman
        await batch.commit();
        batch = writeBatch(db);
        operationCounter = 0;
      }
    }
    
    if (operationCounter > 0) {
      await batch.commit();
    }

    auditService.logAction('CREATE_BULK', 'Peserta', `Mendaftarkan ${validParticipants.length} peserta baru secara masal`);
    return { successCount: validParticipants.length, errorCount: errorCount + (participantsList.length - validParticipants.length) };
  },

  async updateParticipant(id, participantData, photoFile, oldPhotoUrl) {
    if (isMockMode) {
      const idx = mockParticipants.findIndex(p => p.id === id);
      if (idx > -1) {
        mockParticipants[idx] = { ...mockParticipants[idx], ...participantData };
      }
      return;
    }

    const { eventId, ...dataToSave } = participantData;
    let photoUrl = dataToSave.photoUrl || oldPhotoUrl;
    
    // Compress photo to Base64 and store directly in Firestore
    if (photoFile) {
      photoUrl = await compressImageToBase64(photoFile);
    }

    const docRef = doc(db, PARTICIPANTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...dataToSave,
      photoUrl,
      updatedAt: new Date().toISOString()
    });
  },

  async deleteParticipant(id) {
    if (isMockMode) {
      const idx = mockParticipants.findIndex(p => p.id === id);
      if (idx !== -1) {
        const pName = mockParticipants[idx].name;
        mockParticipants[idx].isDeleted = true;
        mockParticipants[idx].deletedAt = new Date().toISOString();
        auditService.logAction('DELETE', 'Peserta', `Mengarsipkan data peserta: ${pName}`);
      }
      return;
    }

    const docSnap = await getDoc(doc(db, PARTICIPANTS_COLLECTION, id));
    if (docSnap.exists()) {
      const pData = docSnap.data();
      await updateDoc(doc(db, PARTICIPANTS_COLLECTION, id), {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
      auditService.logAction('DELETE', 'Peserta', `Mengarsipkan data peserta: ${pData.name}`);
    }
  },
};

// Export mockParticipants so attendanceService can access it in mock mode
export { mockParticipants };
