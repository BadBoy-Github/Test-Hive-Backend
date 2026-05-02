const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

const isAdminEmail = (email) => {
  const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
  return adminEmails.includes(email.trim());
};

exports.register = async (req, res) => {
  // Set CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://test-hive-frontend.vercel.app'
  ];

  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.match(/https:\/\/test-hive-frontend.*\.vercel\.app/))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = isAdminEmail(email) ? 'admin' : 'student';
    const user = new User({ name, email, phone, password: hashedPassword, role });
    await user.save();

    const token = jwt.sign({ id: user._id, email, role }, process.env.JWT_SECRET, { expiresIn: '3h' });
    res.status(201).json({ token, user: { id: user._id, name, email, phone, role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  // Set CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://test-hive-frontend.vercel.app'
  ];

  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.match(/https:\/\/test-hive-frontend.*\.vercel\.app/))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const role = isAdminEmail(email) ? 'admin' : 'student';
    const token = jwt.sign({ id: user._id, email, role }, process.env.JWT_SECRET, { expiresIn: '3h' });
    res.json({ token, user: { id: user._id, name: user.name, email, role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};