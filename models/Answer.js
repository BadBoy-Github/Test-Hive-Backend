const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  userAnswer: { type: mongoose.Schema.Types.Mixed }, // Can be string or array
  isCorrect: { type: Boolean },
  marksObtained: { type: Number, default: 0 },
  timeTaken: { type: Number }, // in seconds
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Answer', answerSchema);