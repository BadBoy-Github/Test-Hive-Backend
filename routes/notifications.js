const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// CORS middleware for notification routes
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

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

router.post('/send-result', async (req, res) => {
  try {
    const { email, userName, testTitle, score, totalMarks } = req.body;
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Test Result: ${testTitle}`,
      html: `<h2>Test Result</h2><p>Hello ${userName},</p><p>You scored ${score}/${totalMarks} in ${testTitle}.</p>`
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.post('/send-reminder', async (req, res) => {
  try {
    const { email, userName, testTitle, duration } = req.body;
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Test Reminder: ${testTitle}`,
      html: `<h2>Test Reminder</h2><p>Hello ${userName},</p><p>Your test ${testTitle} is available. Duration: ${duration} minutes.</p>`
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

module.exports = router;