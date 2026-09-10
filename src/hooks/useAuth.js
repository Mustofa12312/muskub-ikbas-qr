import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isMockMode) {
      // Bypass Firebase Auth for UI testing
      setCurrentUser({ email: 'demo@muskub.com', uid: 'mock-admin', role: 'SUPER_ADMIN' });
      setLoading(false);
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          let role = 'SUPER_ADMIN'; // Default fallback
          if (userDoc.exists()) {
            role = userDoc.data().role || 'SUPER_ADMIN';
          } else {
            // Auto-create user document if it doesn't exist to satisfy Firestore rules
            try {
              const { setDoc } = await import('firebase/firestore');
              await setDoc(userDocRef, {
                email: user.email,
                role: 'SUPER_ADMIN',
                createdAt: new Date().toISOString()
              });
              console.log("Created missing user profile with SUPER_ADMIN role");
            } catch (e) {
              console.warn("Could not auto-create user profile", e);
            }
          }
          
          setCurrentUser({ ...user, role });
        } catch (error) {
          console.error("Error fetching user role:", error);
          setCurrentUser({ ...user, role: 'SUPER_ADMIN' });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { currentUser, loading };
}
