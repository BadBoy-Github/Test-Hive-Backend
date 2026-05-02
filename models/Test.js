const mongoose = require('mongoose');
const Question = require('./Question');

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  duration: { type: Number, required: true },
  passingScore: { type: Number, default: 50 },
  negativeMarking: { type: Boolean, default: false },
  negativeMarkingValue: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 1 },
  isActive: { type: Boolean, default: false },
  showResults: { type: Boolean, default: false },
  randomizeQuestions: { type: Boolean, default: false },
  randomizeOptions: { type: Boolean, default: false },
  publicLeaderboard: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  totalMarks: { type: Number, default: 0 }
});

// Method to recalculate total marks from all questions
testSchema.methods.recalculateTotalMarks = async function() {
  const result = await Question.aggregate([
    { $match: { testId: this._id } },
    { $group: { _id: null, total: { $sum: '$marks' } } }
  ]);
  this.totalMarks = result.length > 0 ? result[0].total : 0;
  await this.save();
};

module.exports = mongoose.model('Test', testSchema);