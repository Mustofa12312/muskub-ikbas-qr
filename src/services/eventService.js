import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

const EVENTS_COLLECTION = 'events';

export const eventService = {
  // Ambil semua acara
  async getAllEvents() {
    const q = query(collection(db, EVENTS_COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Ambil detail satu acara
  async getEventById(id) {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    throw new Error('Acara tidak ditemukan');
  },

  // Tambah acara baru
  async createEvent(eventData) {
    const docRef = await addDoc(collection(db, EVENTS_COLLECTION), {
      ...eventData,
      status: eventData.status || 'active',
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  },

  // Update acara
  async updateEvent(id, eventData) {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...eventData,
      updatedAt: new Date().toISOString()
    });
  },

  // Hapus acara
  async deleteEvent(id) {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    await deleteDoc(docRef);
  }
};
