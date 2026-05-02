const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  createdAt: { type: Date, default: Date.now },
  lastAttemptDate: { type: Date },
  streak: { type: Number, default: 0 },
  studyDates: [{ type: Date }]
});

module.exports = mongoose.model('User', userSchema);