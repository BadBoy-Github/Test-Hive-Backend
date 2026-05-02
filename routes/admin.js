const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Import controllers
const analyticsController = require('../controllers/analyticsController');
const studentController = require('../controllers/studentController');
const testController = require('../controllers/testController');
const attemptController = require('../controllers/attemptController');

// CORS middleware for admin routes
router.use((req, res, next) => {
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

// Analytics routes
router.get('/analytics', auth, admin, analyticsController.getAnalytics);

// Student management routes
router.get('/students', auth, admin, studentController.getAllStudents);
router.post('/students', auth, admin, studentController.createStudent);
router.put('/students/:id', auth, admin, studentController.updateStudent);
router.delete('/students/:id', auth, admin, studentController.deleteStudent);

// Test management routes (moved from tests.js for consistency)
router.get('/tests', auth, admin, testController.getAllTestsAdmin);
router.patch('/tests/:id', auth, admin, testController.updateTest);

// Test results
router.get('/test-results/:testId', auth, admin, attemptController.getTestResultsAdmin);
router.get('/attempt/:attemptId', auth, admin, attemptController.getAttemptAdmin);

// Leaderboard
router.get('/leaderboard', auth, admin, attemptController.getLeaderboard);
router.get('/leaderboard/:testId', auth, admin, attemptController.getLeaderboardByTest);

module.exports = router;