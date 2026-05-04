const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  userAnswer: { type: mongoose.Schema.Types.Mixed },
  isCorrect: { type: Boolean },
  marksObtained: { type: Number, default: 0 },
  timeTaken: { type: Number },
  submittedAt: { type: Date, default: Date.now }
});

// Ensure one answer per question per attempt
answerSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('Answer', answerSchema);