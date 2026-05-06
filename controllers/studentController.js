const User = require('../models/User');
const Attempt = require('../models/Attempt');
const Answer = require('../models/Answer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendWelcomeEmail } = require('../services/emailService');

exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password').sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    console.error('getAllStudents error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.createStudent = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password || 'password123', 10); // Default password
    const user = new User({ name, email, phone, password: hashedPassword, role: 'student' });
    await user.save();

    // Send welcome email to created student (async)
    sendWelcomeEmail({ name: user.name, email: user.email }).catch(err => {
      console.error('Failed to send welcome email to student:', err.message);
    });

    const student = { _id: user._id, name, email, phone, role: 'student', createdAt: user.createdAt };
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateStudent = async (req, res) => {
  const { name, phone } = req.body; // Don't allow email changes

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'Student not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    // Delete the user
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Student not found' });

    // Delete all attempts by this user
    await Attempt.deleteMany({ userId: req.params.id });

    // Delete all answers by this user
    await Answer.deleteMany({ attemptId: { $in: await Attempt.find({ userId: req.params.id }).distinct('_id') } });

    res.json({ message: 'Student and all associated data deleted successfully' });
  } catch (err) {
    console.log('Delete student error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};