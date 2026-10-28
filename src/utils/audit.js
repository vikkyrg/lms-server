const AuditLog = require('../models/AuditLog');

const logAudit = async ({ action, performedBy, role, targetResource, targetId, details, ipAddress }) => {
  try {
    await AuditLog.create({
      action,
      performedBy: performedBy?._id || performedBy,
      role: role || (performedBy?.role ? performedBy.role : 'system'),
      targetResource,
      targetId: targetId ? String(targetId) : '',
      details: details || {},
      ipAddress: ipAddress || ''
    });
  } catch (err) {
    console.error('Audit Log failure (non-blocking):', err.message);
  }
};

module.exports = { logAudit };

