import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from './firebase';
import { auditService } from './auditService';

const USERS_COLLECTION = 'users';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

// Create a secondary app instance for creating users without logging out the current admin
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

let mockUsers = [
  { id: 'mock-admin', email: 'admin@muskub.com', role: 'SUPER_ADMIN', name: 'Super Admin', createdAt: new Date().toISOString() },
  { id: 'mock-op', email: 'operator@muskub.com', role: 'OPERATOR', name: 'Pintu Gerbang 1', createdAt: new Date().toISOString() }
];

export const userService = {
  async getAllUsers() {
    if (isMockMode) return [...mockUsers];

    const q = query(collection(db, USERS_COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async createUser(userData) {
    if (isMockMode) {
      const newId = 'usr_' + Date.now();
      const newUser = { ...userData, id: newId, createdAt: new Date().toISOString() };
      mockUsers.push(newUser);
      auditService.logAction('CREATE', 'User', `Membuat akun baru: ${userData.email}`);
      return newId;
    }

    try {
      // 1. Create user in Firebase Auth using the secondary app
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.password);
      const uid = userCredential.user.uid;
      
      // Sign out from the secondary app immediately
      await secondaryAuth.signOut();

      // 2. Create the user document in Firestore with the role
      const userDocRef = doc(db, USERS_COLLECTION, uid);
      await setDoc(userDocRef, {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        createdAt: new Date().toISOString()
      });

      auditService.logAction('CREATE', 'User', `Membuat akun baru: ${userData.email} dengan peran ${userData.role}`);
      return uid;
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error(error.message);
    }
  },

  async updateUserRole(uid, newRole, email) {
    if (isMockMode) {
      const idx = mockUsers.findIndex(u => u.id === uid);
      if (idx > -1) {
        mockUsers[idx] = { ...mockUsers[idx], role: newRole };
        auditService.logAction('UPDATE', 'User', `Mengubah peran ${email} menjadi ${newRole}`);
      }
      return;
    }

    const userDocRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userDocRef, { role: newRole });
    auditService.logAction('UPDATE', 'User', `Mengubah peran ${email} menjadi ${newRole}`);
  },

  async removeUserDocument(uid, email) {
    if (isMockMode) {
      mockUsers = mockUsers.filter(u => u.id !== uid);
      auditService.logAction('DELETE', 'User', `Mencabut akses (hapus doc) untuk ${email}`);
      return;
    }

    // Note: We cannot delete the Auth User directly from client SDK without them being signed in,
    // so we only delete their Firestore document, effectively removing their RBAC permissions.
    // To truly delete them, it requires Firebase Admin SDK (Cloud Functions) or manual deletion in Console.
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    await deleteDoc(userDocRef);
    auditService.logAction('DELETE', 'User', `Mencabut akses (hapus profil) untuk ${email}`);
  }
};
