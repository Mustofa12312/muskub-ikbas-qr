import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

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
        .filter(p => p.eventId === eventId)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const q = query(
      collection(db, PARTICIPANTS_COLLECTION),
      where('eventId', '==', eventId),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async createParticipant(participantData, photoFile) {
    let photoUrl = '';
    
    if (isMockMode) {
      const id = Math.random().toString(36).substr(2, 9);
      const newParticipant = {
        ...participantData,
        id,
        photoUrl: '', // Mock doesn't support real storage upload easily without DataURL
        status: 'BELUM HADIR',
        qrCode: `MUSKUB4-PST-${id}`,
        createdAt: new Date().toISOString()
      };
      mockParticipants.push(newParticipant);
      return newParticipant;
    }

    if (photoFile) {
      photoUrl = await this.uploadPhoto(participantData.eventId, photoFile);
    }

    const newParticipant = {
      ...participantData,
      photoUrl,
      status: 'BELUM HADIR',
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipant);
    const qrCode = `MUSKUB4-PST-${docRef.id}`;
    await updateDoc(docRef, { qrCode });

    return { id: docRef.id, ...newParticipant, qrCode };
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
      mockParticipants = mockParticipants.filter(p => p.id !== id);
      return;
    }

    const docRef = doc(db, PARTICIPANTS_COLLECTION, id);
    await deleteDoc(docRef);
  },

  async uploadPhoto(eventId, file) {
    if (isMockMode) return '';
    const fileExt = file.name.split('.').pop();
    const fileName = `participants/${eventId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
};

// Export mockParticipants so attendanceService can access it in mock mode
export { mockParticipants };
