import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

const EVENTS_COLLECTION = 'events';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

// Mock Data Storage
let mockEvents = [
  { id: '1', name: 'MUSKUB IV IKBAS', date: '2026-10-10', location: 'Gedung Utama', description: 'Musyawarah Kubro IV', status: 'active', createdAt: new Date().toISOString() }
];

export const eventService = {
  async getAllEvents() {
    if (isMockMode) return [...mockEvents].sort((a, b) => b.date.localeCompare(a.date));
    
    const q = query(collection(db, EVENTS_COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getEventById(id) {
    if (isMockMode) {
      const evt = mockEvents.find(e => e.id === id);
      if (evt) return { ...evt };
      throw new Error('Acara tidak ditemukan');
    }

    const docRef = doc(db, EVENTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    throw new Error('Acara tidak ditemukan');
  },

  async createEvent(eventData) {
    if (isMockMode) {
      const newEvent = {
        ...eventData,
        id: Math.random().toString(36).substr(2, 9),
        status: eventData.status || 'active',
        createdAt: new Date().toISOString()
      };
      mockEvents.push(newEvent);
      return newEvent.id;
    }

    const docRef = await addDoc(collection(db, EVENTS_COLLECTION), {
      ...eventData,
      status: eventData.status || 'active',
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  },

  async updateEvent(id, eventData) {
    if (isMockMode) {
      const idx = mockEvents.findIndex(e => e.id === id);
      if (idx > -1) {
        mockEvents[idx] = { ...mockEvents[idx], ...eventData, updatedAt: new Date().toISOString() };
      }
      return;
    }

    const docRef = doc(db, EVENTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...eventData,
      updatedAt: new Date().toISOString()
    });
  },

  async deleteEvent(id) {
    if (isMockMode) {
      mockEvents = mockEvents.filter(e => e.id !== id);
      return;
    }

    const docRef = doc(db, EVENTS_COLLECTION, id);
    await deleteDoc(docRef);
  }
};
