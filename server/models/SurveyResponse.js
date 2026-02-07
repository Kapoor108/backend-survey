const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questionNumber: { type: String },
  // Present Aspect - user selects ONE option
  presentOptionIndex: { type: Number },
  presentCreativityMarks: { type: Number, default: 0 },
  presentMoralityMarks: { type: Number, default: 0 },
  // Future Aspect - user selects ONE option
  futureOptionIndex: { type: Number },
  futureCreativityMarks: { type: Number, default: 0 },
  futureMoralityMarks: { type: Number, default: 0 }
});

const surveyResponseSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  answers: [answerSchema],
  // Present Aspect Totals
  presentCreativityTotal: { type: Number, default: 0 },
  presentMoralityTotal: { type: Number, default: 0 },
  presentCreativityPercentage: { type: Number, default: 0 },
  presentMoralityPercentage: { type: Number, default: 0 },
  presentCreativityBand: { type: String, enum: ['Early', 'Emerging', 'Leading'], default: 'Early' },
  presentMoralityBand: { type: String, enum: ['Early', 'Emerging', 'Leading'], default: 'Early' },
  // Future Aspect Totals
  futureCreativityTotal: { type: Number, default: 0 },
  futureMoralityTotal: { type: Number, default: 0 },
  futureCreativityPercentage: { type: Number, default: 0 },
  futureMoralityPercentage: { type: Number, default: 0 },
  futureCreativityBand: { type: String, enum: ['Early', 'Emerging', 'Leading'], default: 'Early' },
  futureMoralityBand: { type: String, enum: ['Early', 'Emerging', 'Leading'], default: 'Early' },
  isDraft: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now }
});

surveyResponseSchema.index({ surveyId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
