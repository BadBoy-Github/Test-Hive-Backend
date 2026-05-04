const Attempt = require('../models/Attempt');
const Answer = require('../models/Answer');
const Test = require('../models/Test');
const Question = require('../models/Question');
const User = require('../models/User');

// Helper function to update user streak
const updateUserStreak = async (userId, attemptDate) => {
  const user = await User.findById(userId);
  if (!user) return;

  const today = new Date(attemptDate);
  today.setHours(0, 0, 0, 0);
  
  const studyDates = user.studyDates || [];
  const todayAlreadyAdded = studyDates.some(d => {
    const dDate = new Date(d);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === today.getTime();
  });

  if (!todayAlreadyAdded) {
    studyDates.push(today);
    user.studyDates = studyDates;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const hasToday = studyDates.some(d => {
    const dDate = new Date(d);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === today.getTime();
  });
  
  const hasYesterday = studyDates.some(d => {
    const dDate = new Date(d);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === yesterday.getTime();
  });

  if (hasToday && hasYesterday) {
    user.streak = (user.streak || 0) + 1;
  } else if (hasToday) {
    user.streak = 1;
  }

  user.lastAttemptDate = attemptDate;
  await user.save();
};

exports.startAttempt = async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) return res.status(404).json({ message: 'Test not found' });

    if (!test.isActive) return res.status(400).json({ message: 'Test is not currently available' });

    const existingAttempts = await Attempt.countDocuments({
      testId: req.params.testId,
      userId: req.user.id,
      status: 'completed'
    });
    if (existingAttempts >= test.maxAttempts) {
      return res.status(400).json({
        message: 'Maximum attempts reached',
        attemptsUsed: existingAttempts,
        maxAttempts: test.maxAttempts
      });
    }

    const ongoingAttempt = await Attempt.findOne({
      testId: req.params.testId,
      userId: req.user.id,
      status: 'ongoing'
    });

    if (ongoingAttempt) {
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
      if (question.correctAnswer) {
        const correctAnswer = Array.isArray(question.correctAnswer)
          ? question.correctAnswer[0]
          : question.correctAnswer;

        const userAns = typeof userAnswer === 'string' ? userAnswer.trim().toLowerCase() : '';
        const correctAns = typeof correctAnswer === 'string' ? correctAnswer.trim().toLowerCase() : '';

        isCorrect = userAns !== '' && userAns === correctAns;

        if (isCorrect) {
          marksObtained = question.marks;
        } else if (test.negativeMarking) {
          marksObtained = -test.negativeMarkingValue;
        }
      } else {
        isCorrect = false;
        marksObtained = 0;
      }
    }

    // Remove any existing answers for this question to prevent duplicates
    await Answer.deleteMany({ attemptId: req.params.attemptId, questionId });

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
    ).populate('testId');

    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const allAnswers = await Answer.find({ attemptId: req.params.attemptId });

    // Deduplicate: keep only the latest answer per question
    const latestMap = new Map();
    allAnswers.forEach(ans => {
      const qId = ans.questionId.toString();
      const existing = latestMap.get(qId);
      if (!existing || new Date(ans.submittedAt) > new Date(existing.submittedAt)) {
        latestMap.set(qId, ans);
      }
    });
    const answers = Array.from(latestMap.values());

    // Delete duplicate answers from DB to keep clean
    if (allAnswers.length > answers.length) {
      const keptIds = answers.map(a => a._id);
      await Answer.deleteMany({
        attemptId: req.params.attemptId,
        _id: { $nin: keptIds }
      });
    }

    const totalScore = answers.reduce((sum, ans) => sum + ans.marksObtained, 0);

    const startTime = new Date(attempt.startTime);
    const endTime = new Date();
    const totalTime = (endTime - startTime) / 60000;

    const test = attempt.testId;
    const maxScore = test.totalMarks || 0;

    attempt.score = totalScore;
    attempt.totalTime = totalTime;
    attempt.passed = maxScore > 0 && (totalScore / maxScore) * 100 >= test.passingScore;
    attempt.isFirstAttempt = !(await Attempt.exists({
      testId: attempt.testId,
      userId: attempt.userId,
      status: 'completed',
      _id: { $ne: attempt._id }
    }));
    await attempt.save();

    updateUserStreak(req.user.id, new Date());

    res.json(attempt);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getResults = async (req, res) => {
  try {
    const attempts = await Attempt.find({ userId: req.user.id, isCompleted: true })
      .populate('testId', 'title showResults totalMarks')
      .sort({ createdAt: -1 });

    const validAttempts = attempts.filter(attempt => attempt.testId);

    const results = await Promise.all(validAttempts.map(async (attempt) => {
      let answers = await Answer.find({ attemptId: attempt._id })
        .populate({
          path: 'questionId',
          select: 'questionText type correctAnswer explanation marks'
        })
        .sort({ submittedAt: -1 }); // newest first

      // Deduplicate: keep the most recent answer per question
      const seen = new Set();
      const dedupedAnswers = answers.filter(answer => {
        const qId = answer.questionId._id.toString();
        if (seen.has(qId)) return false;
        seen.add(qId);
        return true;
      });

      let detailedAnswers = dedupedAnswers;
      if (!attempt.testId.showResults) {
        detailedAnswers = dedupedAnswers
          .filter(answer => answer.questionId)
          .map(answer => ({
            ...answer.toObject(),
            questionId: {
              ...answer.questionId.toObject(),
              correctAnswer: undefined,
              explanation: undefined
            }
          }));
      } else {
        detailedAnswers = dedupedAnswers.filter(answer => answer.questionId);
      }

      return {
        ...attempt.toObject(),
        answers: detailedAnswers
      };
    }));

    res.json(results);
   } catch (err) {
     console.error('Get results error:', err);
     res.status(500).json({ message: 'Server error', error: err.message });
   }
 };

exports.getTestResultsAdmin = async (req, res) => {
  try {
    const attempts = await Attempt.find({ testId: req.params.testId, isCompleted: true })
      .populate('userId', 'name email')
      .sort({ endTime: -1 });

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

    const students = Object.values(userMap).map(student => {
      student.attempts.sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
      student.attempts.forEach((attempt, index) => {
        attempt.number = student.attempts.length - index;
      });
      student.latestScore = student.attempts[0].score;
      return student;
    });

    students.sort((a, b) => b.latestScore - a.latestScore);

    res.json(students);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAttemptAdmin = async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.attemptId)
      .populate('testId', 'title showResults totalMarks')
      .populate('userId', 'name email');

    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    let answers = await Answer.find({ attemptId: attempt._id })
      .populate({
        path: 'questionId',
        select: 'questionText type correctAnswer explanation marks'
      })
      .sort({ submittedAt: -1 }); // newest first

    // Deduplicate: keep the most recent answer per question
    const seen = new Set();
    const dedupedAnswers = answers.filter(answer => {
      const qId = answer.questionId._id.toString();
      if (seen.has(qId)) return false;
      seen.add(qId);
      return true;
    });

    res.json({
      ...attempt.toObject(),
      answers: dedupedAnswers
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const users = await User.find({ role: 'student' })
      .select('name email streak')
      .sort({ streak: -1 });

    const leaderboard = await Promise.all(users.map(async (user) => {
      const attempts = await Attempt.find({ userId: user._id, isCompleted: true });
      const averageScore = attempts.length > 0
        ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
        : 0;
      
      return {
        userId: { _id: user._id, name: user.name, email: user.email },
        averageScore: Math.round(averageScore),
        testsTaken: attempts.length,
        streak: user.streak || 0
      };
    }));

    leaderboard.sort((a, b) => {
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      if (b.testsTaken !== a.testsTaken) return b.testsTaken - a.testsTaken;
      return b.streak - a.streak;
    });

    res.json(leaderboard.map((entry, i) => ({ ...entry, rank: i + 1 })));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLeaderboardByTest = async (req, res) => {
  try {
    const attempts = await Attempt.find({ 
      testId: req.params.testId, 
      isCompleted: true 
    }).populate('userId', 'name email');

    const userMap = {};
    attempts.forEach(attempt => {
      const userId = attempt.userId._id.toString();
      if (!userMap[userId]) {
        userMap[userId] = {
          userId: { _id: userId, name: attempt.userId.name, email: attempt.userId.email },
          scores: [],
          bestScore: 0,
          attempts: 0
        };
      }
      userMap[userId].scores.push(attempt.score);
      userMap[userId].bestScore = Math.max(userMap[userId].bestScore, attempt.score);
      userMap[userId].attempts++;
    });

    const leaderboard = Object.values(userMap)
      .map(entry => ({
        ...entry,
        averageScore: Math.round(entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length)
      }))
      .sort((a, b) => b.bestScore - a.bestScore);

    res.json(leaderboard.map((entry, i) => ({ ...entry, rank: i + 1 })));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};