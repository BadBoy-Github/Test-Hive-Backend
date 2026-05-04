const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  questionText: { type: String, required: true },
  type: { type: String, enum: ['mcq', 'checkbox', 'descriptive', 'coding'], required: true },
  options: [{ type: String }], // for MCQ and checkbox
  correctAnswer: [{ type: String }], // for MCQ, checkbox, and coding (array to support multiple correct answers)
  marks: { type: Number, default: 1 },
  explanation: { type: String }, // hidden during test
  order: { type: Number, default: 0 }, // for reordering questions
  imageUrl: { type: String }, // optional image URL for the question
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Question', questionSchema);