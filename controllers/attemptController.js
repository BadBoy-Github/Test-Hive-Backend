const Attempt = require('../models/Attempt');
const Answer = require('../models/Answer');
const Test = require('../models/Test');
const Question = require('../models/Question');

exports.startAttempt = async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) return res.status(404).json({ message: 'Test not found' });

    // Check if test is active
    if (!test.isActive) return res.status(400).json({ message: 'Test is not currently available' });

    // Check max attempts
    const existingAttempts = await Attempt.countDocuments({
      testId: req.params.testId,
      userId: req.user.id,
      status: { $ne: 'abandoned' } // Don't count abandoned attempts
    });
    if (existingAttempts >= test.maxAttempts) {
      return res.status(400).json({
        message: 'Maximum attempts reached',
        attemptsUsed: existingAttempts,
        maxAttempts: test.maxAttempts
      });
    }

    const attempt = new Attempt({ testId: req.params.testId, userId: req.user.id });
    await attempt.save();
    res.status(201).json(attempt);
  } catch (err) {
    console.log('Start attempt error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitAnswer = async (req, res) => {
  const { questionId, userAnswer, timeTaken } = req.body;
  try {
    const attempt = await Attempt.findOne({ _id: req.params.attemptId, userId: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    let isCorrect = false;
    let marksObtained = 0;

    if ((question.type === 'mcq' || question.type === 'checkbox') && question.correctAnswer) {
      const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
      const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];

      // For MCQ, user should select exactly one correct answer
      // For checkbox, user should select all correct answers
      if (question.type === 'mcq') {
        isCorrect = correctAnswers.length === 1 && userAnswers.length === 1 && correctAnswers[0] === userAnswers[0];
      } else if (question.type === 'checkbox') {
        isCorrect = correctAnswers.length === userAnswers.length &&
                   correctAnswers.every(ans => userAnswers.includes(ans)) &&
                   userAnswers.every(ans => correctAnswers.includes(ans));
      }

      if (isCorrect) {
        marksObtained = question.marks;
      }
    } else if (question.type === 'coding') {
      // For coding, assume auto-evaluation for now, or manual later
      // Placeholder
      marksObtained = 0; // Will be evaluated later
    }

    const answer = new Answer({
      attemptId: req.params.attemptId,
      questionId,
      userAnswer,
      isCorrect,
      marksObtained,
      timeTaken
    });
    await answer.save();

    res.json(answer);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.completeAttempt = async (req, res) => {
  try {
    const attempt = await Attempt.findOneAndUpdate(
      { _id: req.params.attemptId, userId: req.user.id },
      { isCompleted: true, endTime: new Date(), status: 'completed' },
      { new: true }
    );

    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    // Calculate score
    const answers = await Answer.find({ attemptId: req.params.attemptId });
    const totalScore = answers.reduce((sum, ans) => sum + ans.marksObtained, 0);
    attempt.score = totalScore;
    await attempt.save();

    res.json(attempt);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getResults = async (req, res) => {
  try {
    const attempts = await Attempt.find({ userId: req.user.id, isCompleted: true })
      .populate('testId', 'title showResults')
      .sort({ createdAt: -1 });

    // Filter out attempts with invalid or missing test references
    const validAttempts = attempts.filter(attempt => attempt.testId);

    const results = await Promise.all(validAttempts.map(async (attempt) => {
      const answers = await Answer.find({ attemptId: attempt._id })
        .populate({
          path: 'questionId',
          select: 'questionText type correctAnswer explanation marks'
        });

      let detailedAnswers = answers;
      if (!attempt.testId.showResults) {
        // Hide correct answers and explanations if not allowed
        detailedAnswers = answers
          .filter(answer => answer.questionId) // Only include answers with valid questions
          .map(answer => ({
            ...answer.toObject(),
            questionId: {
              ...answer.questionId.toObject(),
              correctAnswer: undefined,
              explanation: undefined
            }
          }));
      } else {
        // Also filter out answers with invalid questions even when showing results
        detailedAnswers = answers.filter(answer => answer.questionId);
      }

      return {
        ...attempt.toObject(),
        answers: detailedAnswers
      };
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};