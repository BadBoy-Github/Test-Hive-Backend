const express = require('express');
const router = express.Router();
const attemptController = require('../controllers/attemptController');
const auth = require('../middleware/auth');

router.post('/:testId/start', auth, attemptController.startAttempt);
router.post('/:attemptId/answer', auth, attemptController.submitAnswer);
router.post('/:attemptId/complete', auth, attemptController.completeAttempt);
router.get('/results', auth, attemptController.getResults);
router.get('/leaderboard', auth, attemptController.getLeaderboard);
router.get('/leaderboard/:testId', auth, attemptController.getLeaderboardByTest);

module.exports = router;