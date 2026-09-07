class AuditService {
  constructor() {
    // In Mock Mode, we store logs in memory
    this.logs = [];
  }

  logAction(action, module, details, user = 'Admin') {
    const newLog = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action,
      module,
      details,
      user
    };
    this.logs.unshift(newLog); // Add to beginning
  }

  getLogs() {
    return this.logs;
  }
}

export const auditService = new AuditService();
