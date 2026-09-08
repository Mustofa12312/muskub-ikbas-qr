import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { auditService } from './auditService';

const EVENTS_COLLECTION = 'events';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

// Mock Data Storage
let mockEvents = [
  { id: '1', name: 'MUSKUB IV IKBAS', date: '2026-10-10', location: 'Gedung Utama', description: 'Musyawarah Kubro IV', status: 'active', createdAt: new Date().toISOString() }
];

export const eventService = {
  async getAllEvents() {
    if (isMockMode) return [...mockEvents].sort((a, b) => new Date(b.date) - new Date(a.date));
    
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
    let newId;
    if (isMockMode) {
      newId = 'EVT' + Date.now();
      const newEvent = { ...eventData, id: newId, status: 'active', createdAt: new Date().toISOString() };
      mockEvents.unshift(newEvent);
    } else {
      const docRef = await addDoc(collection(db, EVENTS_COLLECTION), {
        ...eventData,
        status: eventData.status || 'active',
        createdAt: new Date().toISOString()
      });
      newId = docRef.id;
    }
    auditService.logAction('CREATE', 'Acara', `Menambahkan acara baru: ${eventData.name}`);
    return newId;
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
      const eventIndex = mockEvents.findIndex(e => e.id === id);
      if (eventIndex !== -1) {
        const eventName = mockEvents[eventIndex].name;
        mockEvents.splice(eventIndex, 1);
        auditService.logAction('DELETE', 'Acara', `Menghapus acara: ${eventName}`);
      }
      return;
    }

    const docSnap = await getDoc(doc(db, EVENTS_COLLECTION, id));
    if (docSnap.exists()) {
      const eventName = docSnap.data().name;
      await deleteDoc(doc(db, EVENTS_COLLECTION, id));
      auditService.logAction('DELETE', 'Acara', `Menghapus acara: ${eventName}`);
    }
  }
};
