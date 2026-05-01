const User = require('../models/User');
const Test = require('../models/Test');
const Attempt = require('../models/Attempt');
const Answer = require('../models/Answer');

exports.getAnalytics = async (req, res) => {
  try {
    // Basic counts
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTests = await Test.countDocuments();
    const totalAttempts = await Attempt.countDocuments({ status: 'completed' });

    // Top students by average score
    const studentStats = await Attempt.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$userId',
          totalScore: { $sum: '$score' },
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$score' }
        }
      },
      { $sort: { averageScore: -1 } },
      { $limit: 3 }
    ]);

    // Populate student details
    const topStudents = await Promise.all(
      studentStats.map(async (stat) => {
        const user = await User.findById(stat._id).select('name email');
        return {
          _id: stat._id,
          name: user ? user.name : 'Deleted User',
          email: user ? user.email : '',
          averageScore: stat.averageScore,
          totalAttempts: stat.totalAttempts
        };
      })
    );

    // Test performance overview
    const testPerformance = await Attempt.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$testId',
          averageScore: { $avg: '$score' },
          highestScore: { $max: '$score' },
          lowestScore: { $min: '$score' },
          attemptsCount: { $sum: 1 }
        }
      },
      { $sort: { attemptsCount: -1 } }
    ]);

    // Populate test details
    const testPerfWithDetails = await Promise.all(
      testPerformance.map(async (perf) => {
        const test = await Test.findById(perf._id).select('title');
        return {
          _id: perf._id,
          title: test ? test.title : 'Deleted Test',
          averageScore: perf.averageScore,
          highestScore: perf.highestScore,
          lowestScore: perf.lowestScore,
          attemptsCount: perf.attemptsCount
        };
      })
    );

    // Recent activity (last 10 completed attempts)
    const recentAttempts = await Attempt.find({ status: 'completed' })
      .populate('userId', 'name')
      .populate('testId', 'title')
      .sort({ endTime: -1 })
      .limit(10);

    const recentActivity = recentAttempts.map(attempt => ({
      description: `${attempt.userId ? attempt.userId.name : 'Deleted User'} completed "${attempt.testId ? attempt.testId.title : 'Deleted Test'}" with ${attempt.score}%`,
      timestamp: attempt.endTime.toLocaleString(),
      type: 'test_completed'
    }));

    // Add test creation activity (mock for now - in real app, you'd track this)
    const recentTests = await Test.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const testCreations = recentTests.map(test => ({
      description: `${test.createdBy ? test.createdBy.name : 'Unknown'} created test "${test.title}"`,
      timestamp: test.createdAt.toLocaleString(),
      type: 'test_created'
    }));

    // Combine and sort all activities
    const allActivities = [...recentActivity, ...testCreations]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    const analytics = {
      totalStudents,
      totalTests,
      totalAttempts,
      topStudents,
      testPerformance: testPerfWithDetails,
      recentActivity: allActivities
    };

    res.json(analytics);
  } catch (err) {
    console.log('Analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};