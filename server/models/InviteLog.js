const mongoose = require('mongoose');

const inviteLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  role: { type: String, enum: ['ceo', 'user'], required: true },
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ['sent', 'clicked', 'accepted', 'expired'], default: 'sent' },
  sentAt: { type: Date, default: Date.now },
  clickedAt: { type: Date },
  acceptedAt: { type: Date },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // 7 days
});

// Index for quick token lookup
inviteLogSchema.index({ token: 1 });
inviteLogSchema.index({ email: 1, status: 1 });

module.exports = mongoose.model('InviteLog', inviteLogSchema);
