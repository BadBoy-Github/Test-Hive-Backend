const mongoose = require('mongoose');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Attempt = require('../models/Attempt');
const Answer = require('../models/Answer');
const User = require('../models/User');
const { sendReminderEmail } = require('../services/emailService');

exports.getAllTests = async (req, res) => {
  try {
    // Show tests that are not explicitly set to inactive
    const tests = await Test.find({ isActive: { $ne: false } }).populate('createdBy', 'name');
    res.json(tests);
  } catch (err) {
    console.error('getAllTests error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getAllTestsAdmin = async (req, res) => {
  try {
    const tests = await Test.find().populate('createdBy', 'name');
    res.json(tests);
  } catch (err) {
    console.error('getAllTestsAdmin error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Test not found' });
    res.json(test);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createTest = async (req, res) => {
  if (!req.body.title || !req.body.duration) {
    return res.status(400).json({ message: 'Title and duration are required' });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const test = new Test({
      title: req.body.title,
      description: req.body.description || '',
      duration: parseInt(req.body.duration),
      passingScore: req.body.passingScore ? parseInt(req.body.passingScore) : 50,
      negativeMarking: req.body.negativeMarking || false,
      negativeMarkingValue: req.body.negativeMarkingValue ? parseInt(req.body.negativeMarkingValue) : 0,
      maxAttempts: req.body.maxAttempts ? parseInt(req.body.maxAttempts) : 1,
      isActive: req.body.isActive || false,
      createdBy: new mongoose.Types.ObjectId(req.user.id)
    });
    await test.save();

    // If test is created as active, send reminder emails to all students
    if (test.isActive) {
      const students = await User.find({ role: 'student' }).select('name email');
      students.forEach(student => {
        sendReminderEmail({
          email: student.email,
          userName: student.name,
          testTitle: test.title,
          duration: test.duration
        }).catch(err => console.error('Failed to send reminder email:', err.message));
      });
    }

    res.status(201).json(test);
  } catch (err) {
    console.log('Error creating test:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateTest = async (req, res) => {
  try {
    const oldTest = await Test.findById(req.params.id);
    if (!oldTest) return res.status(404).json({ message: 'Test not found' });

    const test = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!test) return res.status(404).json({ message: 'Test not found' });

    // If test was just activated (isActive changed from false to true), send reminder emails
    if (!oldTest.isActive && test.isActive) {
      const students = await User.find({ role: 'student' }).select('name email');
      students.forEach(student => {
        sendReminderEmail({
          email: student.email,
          userName: student.name,
          testTitle: test.title,
          duration: test.duration
        }).catch(err => console.error('Failed to send reminder email:', err.message));
      });
    }

    res.json(test);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteTest = async (req, res) => {
  try {
    // Delete the test
    const test = await Test.findByIdAndDelete(req.params.id);
    if (!test) return res.status(404).json({ message: 'Test not found' });

    // Delete all questions for this test
    await Question.deleteMany({ testId: req.params.id });

    // Delete all attempts for this test
    await Attempt.deleteMany({ testId: req.params.id });

    // Delete all answers for this test's attempts
    const attempts = await Attempt.find({ testId: req.params.id });
    const attemptIds = attempts.map(a => a._id);
    await Answer.deleteMany({ attemptId: { $in: attemptIds } });

    res.json({ message: 'Test and all associated data deleted successfully' });
  } catch (err) {
    console.log('Delete test error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getQuestions = async (req, res) => {
  try {
    const questions = await Question.find({ testId: req.params.id }).sort({ order: 1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addQuestion = async (req, res) => {
  const { questionText, type, options, correctAnswer, marks, explanation, imageUrl } = req.body;
  try {
    // Get the current max order for this test
    const maxOrder = await Question.find({ testId: req.params.id }).sort({ order: -1 }).limit(1);
    const order = maxOrder.length > 0 ? maxOrder[0].order + 1 : 1;

    const question = new Question({
      testId: req.params.id,
      questionText,
      type,
      options,
      correctAnswer: Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer].filter(Boolean),
      marks,
      explanation,
      imageUrl,
      order
    });
    await question.save();

    // Recalculate total marks for the test
    const test = await Test.findById(req.params.id);
    if (test) {
      await test.recalculateTotalMarks();
    }

    res.status(201).json(question);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateQuestion = async (req, res) => {
  const { questionText, type, options, correctAnswer, marks, explanation, imageUrl } = req.body;
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.questionId,
      {
        questionText,
        type,
        options,
        correctAnswer: Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer].filter(Boolean),
        marks,
        explanation,
        imageUrl
      },
      { new: true }
    );
    if (!question) return res.status(404).json({ message: 'Question not found' });

    // Recalculate total marks for the test
    const test = await Test.findById(req.params.id);
    if (test) {
      await test.recalculateTotalMarks();
    }

    res.json(question);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const testId = question.testId;

    await Question.findByIdAndDelete(req.params.questionId);

    // Recalculate total marks for the test
    const test = await Test.findById(testId);
    if (test) {
      await test.recalculateTotalMarks();
    }

    res.json({ message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reorderQuestions = async (req, res) => {
  const { questionOrders } = req.body; // Array of { id, order }
  try {
    const updatePromises = questionOrders.map(({ id, order }) =>
      Question.findByIdAndUpdate(id, { order })
    );
    await Promise.all(updatePromises);

    // Recalculate total marks (reordering doesn't change marks but keeping consistent)
    // Actually we can skip since marks don't change, but for safety we could recalc.
    // We'll skip to avoid unnecessary DB query.

    res.json({ message: 'Questions reordered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};