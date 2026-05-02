const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const app = express();

// CORS middleware
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://test-hive-frontend.vercel.app',
    'https://test-hive-frontend-*.vercel.app'
  ];

  const origin = req.headers.origin;

  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin) || origin.match(/https:\/\/test-hive-frontend.*\.vercel\.app/)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

app.use(express.json());

// Routes
app.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], authController.register);

app.post('/login', authController.login);

// Handle OPTIONS for all routes
app.options('*', (req, res) => {
  res.sendStatus(200);
});

module.exports = app;