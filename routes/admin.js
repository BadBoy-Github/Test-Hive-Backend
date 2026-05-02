const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Import controllers
const analyticsController = require('../controllers/analyticsController');
const studentController = require('../controllers/studentController');
const testController = require('../controllers/testController');
const attemptController = require('../controllers/attemptController');

// Analytics routes
router.get('/analytics', auth, admin, analyticsController.getAnalytics);

// Student management routes
router.get('/students', auth, admin, studentController.getAllStudents);
router.post('/students', auth, admin, studentController.createStudent);
router.put('/students/:id', auth, admin, studentController.updateStudent);
router.delete('/students/:id', auth, admin, studentController.deleteStudent);

// Test management routes
router.get('/tests', auth, admin, testController.getAllTestsAdmin);
router.patch('/tests/:id', auth, admin, testController.updateTest);

// Test results
router.get('/test-results/:testId', auth, admin, attemptController.getTestResultsAdmin);
router.get('/attempt/:attemptId', auth, admin, attemptController.getAttemptAdmin);

module.exports = router;