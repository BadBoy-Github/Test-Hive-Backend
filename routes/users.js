const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// GET /api/users/streak - Get current user's streak count
router.get('/streak', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('streak');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ streak: user.streak || 0 });
  } catch (err) {
    console.error('Get streak error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
