import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const AUDIT_COLLECTION = 'auditLogs';
const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;

class AuditService {
  constructor() {
    // Fallback in-memory storage for Mock Mode
    this.logs = [];
  }

  async logAction(action, module, details, user = 'Admin') {
    if (isMockMode) {
      const newLog = {
        id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        action,
        module,
        details,
        user
      };
      this.logs.unshift(newLog);
      return;
    }

    try {
      await addDoc(collection(db, AUDIT_COLLECTION), {
        action,
        module,
        details,
        user,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to write audit log", error);
    }
  }

  async getLogs(limitCount = 100) {
    if (isMockMode) {
      return this.logs.slice(0, limitCount);
    }

    try {
      const q = query(
        collection(db, AUDIT_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
        };
      });
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
      return [];
    }
  }
}

export const auditService = new AuditService();
