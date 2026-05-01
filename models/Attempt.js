const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  isCompleted: { type: Boolean, default: false },
  score: { type: Number, default: 0 },
  tabSwitches: { type: Number, default: 0 },
  totalTime: { type: Number }, // in minutes
  status: { type: String, enum: ['ongoing', 'completed', 'abandoned'], default: 'ongoing' }
});

module.exports = mongoose.model('Attempt', attemptSchema);