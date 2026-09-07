import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

const PARTICIPANTS_COLLECTION = 'participants';

export const participantService = {
  // Ambil semua peserta untuk satu acara
  async getParticipantsByEvent(eventId) {
    const q = query(
      collection(db, PARTICIPANTS_COLLECTION),
      where('eventId', '==', eventId),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Tambah peserta baru
  async createParticipant(participantData, photoFile) {
    let photoUrl = '';
    
    // Upload foto jika ada
    if (photoFile) {
      photoUrl = await this.uploadPhoto(participantData.eventId, photoFile);
    }

    const newParticipant = {
      ...participantData,
      photoUrl,
      status: 'BELUM HADIR', // Default status
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipant);
    
    // Update data dengan QR Code format (contoh: MUSKUB4-PST-[ID])
    const qrCode = `MUSKUB4-PST-${docRef.id}`;
    await updateDoc(docRef, { qrCode });

    return { id: docRef.id, ...newParticipant, qrCode };
  },

  // Update peserta
  async updateParticipant(id, participantData, photoFile, oldPhotoUrl) {
    let photoUrl = participantData.photoUrl || oldPhotoUrl;

    if (photoFile) {
      // Jika upload foto baru, bisa hapus foto lama (opsional) atau overwrite
      photoUrl = await this.uploadPhoto(participantData.eventId, photoFile);
    }

    const docRef = doc(db, PARTICIPANTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...participantData,
      photoUrl,
      updatedAt: new Date().toISOString()
    });
  },

  // Hapus peserta
  async deleteParticipant(id) {
    const docRef = doc(db, PARTICIPANTS_COLLECTION, id);
    await deleteDoc(docRef);
  },

  // Upload foto ke Storage
  async uploadPhoto(eventId, file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `participants/${eventId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
};
