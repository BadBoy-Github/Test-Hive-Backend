const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

router.get('/', testController.getAllTests);
router.get('/:id', testController.getTestById);
router.post('/', auth, admin, testController.createTest);
router.put('/:id', auth, admin, testController.updateTest);
router.delete('/:id', auth, admin, testController.deleteTest);

// Question routes
router.post('/:id/reorder-questions', auth, admin, testController.reorderQuestions);
router.put('/:id/update-question/:questionId', auth, admin, testController.updateQuestion);
router.delete('/:id/questions/:questionId', auth, admin, testController.deleteQuestion);
router.get('/:id/questions', auth, testController.getQuestions);
router.post('/:id/questions', auth, admin, testController.addQuestion);

module.exports = router;