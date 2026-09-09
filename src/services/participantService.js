import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { auditService } from './auditService';
import { compressImage } from '../utils/imageUtils';

const PARTICIPANTS_COLLECTION = 'participants';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

let mockParticipants = [
  { id: 'p1', eventId: '1', name: 'Ahmad Dahlan', delegation: 'PC Pamekasan', position: 'Ketua', status: 'BELUM HADIR', qrCode: 'MUSKUB4-PST-p1' },
  { id: 'p2', eventId: '1', name: 'Siti Aminah', delegation: 'PC Sampang', position: 'Anggota', status: 'BELUM HADIR', qrCode: 'MUSKUB4-PST-p2' },
];

export const participantService = {
  async getParticipantsByEvent(eventId) {
    if (isMockMode) {
      return mockParticipants
        .filter(p => p.eventId === eventId && !p.isDeleted)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const q = query(
      collection(db, PARTICIPANTS_COLLECTION),
      where('eventId', '==', eventId),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => !p.isDeleted); // Client-side filter to support existing data
  },

  async createParticipant(participantData, photoFile) {
    let photoUrl = '';
    
    if (isMockMode) {
      const id = Math.random().toString(36).substr(2, 9);
      const qrCode = participantData.qrCode || `MUSKUB4-PST-${id}`;
      const newParticipant = {
        ...participantData,
        id,
        photoUrl: '', // Mock doesn't support real storage upload easily without DataURL
        status: 'BELUM HADIR',
        qrCode,
        createdAt: new Date().toISOString()
      };
      mockParticipants.push(newParticipant);
      auditService.logAction('CREATE', 'Peserta', `Mendaftarkan peserta baru: ${participantData.name}`);
      return newParticipant;
    }

    if (participantData.qrCode) {
      const q = query(
        collection(db, PARTICIPANTS_COLLECTION),
        where('eventId', '==', participantData.eventId),
        where('qrCode', '==', participantData.qrCode)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        throw new Error('QR Code sudah digunakan oleh peserta lain di acara ini.');
      }
    }

    if (photoFile) {
      photoUrl = await this.uploadPhoto(participantData.eventId, photoFile);
    }

    const newParticipant = {
      ...participantData,
      photoUrl,
      status: 'BELUM HADIR',
      qrCode: participantData.qrCode || '', // Temporary, will update below if empty
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipant);
    
    const qrCode = participantData.qrCode || `MUSKUB4-PST-${docRef.id}`;
    if (!participantData.qrCode) {
      await updateDoc(docRef, { qrCode });
    }
    
    newParticipant.qrCode = qrCode;

    auditService.logAction('CREATE', 'Peserta', `Mendaftarkan peserta baru: ${participantData.name}`);
    return { id: docRef.id, ...newParticipant, qrCode };
  },

  async createBulkParticipants(participantsList, eventId) {
    if (isMockMode) {
      const newParticipants = participantsList.map(p => {
        const id = Math.random().toString(36).substr(2, 9);
        return {
          ...p,
          id,
          eventId,
          photoUrl: '',
          status: 'BELUM HADIR',
          qrCode: p.qrCode || `MUSKUB4-PST-${id}`,
          createdAt: new Date().toISOString()
        };
      });
      mockParticipants.push(...newParticipants);
      auditService.logAction('CREATE_BULK', 'Peserta', `Mendaftarkan ${newParticipants.length} peserta baru`);
      return { successCount: newParticipants.length, errorCount: 0 };
    }

    // Ambil daftar QR Code yang sudah ada di event ini untuk mencegah duplikasi
    const q = query(collection(db, PARTICIPANTS_COLLECTION), where('eventId', '==', eventId));
    const snapshot = await getDocs(q);
    const existingQRCodes = new Set();
    snapshot.docs.forEach(doc => {
      const qr = doc.data().qrCode;
      if (qr) existingQRCodes.add(qr);
    });

    // Validasi data baru
    const validParticipants = [];
    const newQRs = new Set();
    let errorCount = 0;

    for (const p of participantsList) {
      if (p.qrCode && (existingQRCodes.has(p.qrCode) || newQRs.has(p.qrCode))) {
        errorCount++; // Duplikat QR
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
        delegation: p.delegation,
        position: p.position,
        eventId,
        photoUrl: '',
        status: 'BELUM HADIR',
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

    let photoUrl = participantData.photoUrl || oldPhotoUrl;
    if (photoFile) {
      photoUrl = await this.uploadPhoto(participantData.eventId, photoFile);
      if (oldPhotoUrl && typeof oldPhotoUrl === 'string' && oldPhotoUrl.includes('firebasestorage.googleapis.com')) {
        try {
          const oldRef = ref(storage, oldPhotoUrl);
          await deleteObject(oldRef);
        } catch (error) {
          console.warn("Gagal menghapus foto lama:", error);
        }
      }
    }

    const docRef = doc(db, PARTICIPANTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...participantData,
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
      // Note: We don't delete the photo in soft-delete
      await updateDoc(doc(db, PARTICIPANTS_COLLECTION, id), {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
      auditService.logAction('DELETE', 'Peserta', `Mengarsipkan data peserta: ${pData.name}`);
    }
  },

  async uploadPhoto(eventId, file) {
    if (isMockMode) return '';
    
    // Compress the image to WebP with max 800x800 resolution to save storage
    const compressedFile = await compressImage(file);
    
    const fileExt = 'webp'; // Since compressImage outputs webp
    const fileName = `participants/${eventId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, compressedFile);
    return await getDownloadURL(storageRef);
  }
};

// Export mockParticipants so attendanceService can access it in mock mode
export { mockParticipants };
