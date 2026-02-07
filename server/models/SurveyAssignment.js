const mongoose = require('mongoose');

const surveyAssignmentSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  dueDate: { type: Date },
  assignedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

// Index for efficient queries
surveyAssignmentSchema.index({ surveyId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('SurveyAssignment', surveyAssignmentSchema);
