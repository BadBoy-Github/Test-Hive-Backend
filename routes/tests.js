const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// CORS middleware for test routes
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

router.get('/', testController.getAllTests);
router.get('/:id', testController.getTestById);
router.post('/', auth, admin, testController.createTest);
router.put('/:id', auth, admin, testController.updateTest);
router.delete('/:id', auth, admin, testController.deleteTest);

// Keep only test-related routes here

// Question routes - more specific first
router.post('/:id/reorder-questions', auth, admin, testController.reorderQuestions);
router.put('/:id/update-question/:questionId', auth, admin, testController.updateQuestion);
router.delete('/:id/questions/:questionId', auth, admin, testController.deleteQuestion);
router.get('/:id/questions', auth, testController.getQuestions);
router.post('/:id/questions', auth, admin, testController.addQuestion);

module.exports = router;