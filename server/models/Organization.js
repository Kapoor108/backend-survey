const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ceoEmail: { type: String, required: true },
  ceoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  inviteToken: { type: String },
  status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Organization', organizationSchema);
