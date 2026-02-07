const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  role: { type: String, enum: ['admin', 'ceo', 'user'], default: 'user' },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  inviteToken: { type: String },
  inviteStatus: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  acceptedAt: { type: Date },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employee', employeeSchema);
