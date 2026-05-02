const express = require('express');
const router = express.Router();
const attemptController = require('../controllers/attemptController');
const auth = require('../middleware/auth');

// CORS middleware for attempt routes
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

router.post('/:testId/start', auth, attemptController.startAttempt);
router.post('/:attemptId/answer', auth, attemptController.submitAnswer);
router.post('/:attemptId/complete', auth, attemptController.completeAttempt);
router.get('/results', auth, attemptController.getResults);

module.exports = router;