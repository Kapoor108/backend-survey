const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  creativityMarks: { type: Number, default: 0 },
  moralityMarks: { type: Number, default: 0 }
});

const questionSchema = new mongoose.Schema({
  questionNumber: { type: String }, // e.g., "6.01"
  question: { type: String, required: true },
  presentOptions: [optionSchema],  // Present Aspect - ONE array with both C & M marks
  futureOptions: [optionSchema],   // Future Aspect - ONE array with both C & M marks
  required: { type: Boolean, default: true }
});

const surveySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  questions: [questionSchema],
  isTemplate: { type: Boolean, default: false },
  dueDate: { type: Date },
  status: { type: String, enum: ['draft', 'active', 'closed'], default: 'draft' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Survey', surveySchema);
