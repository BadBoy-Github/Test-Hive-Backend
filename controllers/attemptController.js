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

    // Check max attempts - only count completed attempts
    const existingAttempts = await Attempt.countDocuments({
      testId: req.params.testId,
      userId: req.user.id,
      status: 'completed' // Only count completed attempts
    });
    if (existingAttempts >= test.maxAttempts) {
      return res.status(400).json({
        message: 'Maximum attempts reached',
        attemptsUsed: existingAttempts,
        maxAttempts: test.maxAttempts
      });
    }

    // Check if there's already an ongoing attempt for this test
    const ongoingAttempt = await Attempt.findOne({
      testId: req.params.testId,
      userId: req.user.id,
      status: 'ongoing'
    });

    if (ongoingAttempt) {
      // Resume the existing attempt instead of creating a new one
      return res.status(200).json(ongoingAttempt);
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
    const attempt = await Attempt.findOne({ _id: req.params.attemptId, userId: req.user.id }).populate('testId');
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const test = attempt.testId;

    let isCorrect = false;
    let marksObtained = 0;

    if ((question.type === 'mcq' || question.type === 'checkbox') && question.correctAnswer) {
      const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
      const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];

      console.log('Evaluating MCQ/Checkbox:');
      console.log('Question type:', question.type);
      console.log('Correct answers:', correctAnswers);
      console.log('User answers:', userAnswers);

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
      } else if (test.negativeMarking) {
        marksObtained = -test.negativeMarkingValue;
      }
    } else if (question.type === 'descriptive' || question.type === 'coding') {
      // For descriptive and coding questions, compare user's answer with correct answer
      if (question.correctAnswer) {
        // Handle both array and string formats for backward compatibility
        const correctAnswer = Array.isArray(question.correctAnswer)
          ? question.correctAnswer[0]
          : question.correctAnswer;

        // Normalize answers for comparison
        const userAns = typeof userAnswer === 'string' ? userAnswer.trim().toLowerCase() : '';
        const correctAns = typeof correctAnswer === 'string' ? correctAnswer.trim().toLowerCase() : '';

        // Case-insensitive string match
        isCorrect = userAns !== '' && userAns === correctAns;

        if (isCorrect) {
          marksObtained = question.marks;
        } else if (test.negativeMarking) {
          marksObtained = -test.negativeMarkingValue;
        }
      } else {
        // No correct answer set, mark as incorrect
        isCorrect = false;
        marksObtained = 0;
      }
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

    // Calculate score and total time
    const answers = await Answer.find({ attemptId: req.params.attemptId });
    const totalScore = answers.reduce((sum, ans) => sum + ans.marksObtained, 0);

    // Calculate total time in minutes
    const startTime = new Date(attempt.startTime);
    const endTime = new Date();
    const totalTime = (endTime - startTime) / 60000;

    attempt.score = totalScore;
    attempt.totalTime = totalTime;
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

exports.getTestResultsAdmin = async (req, res) => {
  try {
    const attempts = await Attempt.find({ testId: req.params.testId, isCompleted: true })
      .populate('userId', 'name email')
      .sort({ endTime: -1 });

    // Group by user
    const userMap = {};
    attempts.forEach(attempt => {
      const userId = attempt.userId._id.toString();
      if (!userMap[userId]) {
        userMap[userId] = {
          _id: userId,
          name: attempt.userId.name,
          email: attempt.userId.email,
          attempts: []
        };
      }
      userMap[userId].attempts.push({
        _id: attempt._id,
        number: userMap[userId].attempts.length + 1,
        score: attempt.score,
        endTime: attempt.endTime,
        totalTime: attempt.totalTime
      });
    });

    // Convert to array and calculate latest score
    const students = Object.values(userMap).map(student => {
      student.attempts.sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
      student.attempts.forEach((attempt, index) => {
        attempt.number = student.attempts.length - index;
      });
      student.latestScore = student.attempts[0].score;
      return student;
    });

    // Sort students by latest score desc
    students.sort((a, b) => b.latestScore - a.latestScore);

    res.json(students);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAttemptAdmin = async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.attemptId)
      .populate('testId', 'title showResults')
      .populate('userId', 'name email');

    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const answers = await Answer.find({ attemptId: attempt._id })
      .populate({
        path: 'questionId',
        select: 'questionText type correctAnswer explanation marks'
      });

    const detailedAnswers = answers.filter(answer => answer.questionId);

    res.json({
      ...attempt.toObject(),
      answers: detailedAnswers
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};