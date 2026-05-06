const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendWelcomeEmail = async (user) => {
  const transporter = createTransporter();
  const { name, email } = user;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Test Hive!',
    html: `
      <!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome to Test Hive</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fb;
      font-family: Arial, sans-serif;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
    }
    .header {
      background: linear-gradient(135deg, #155dfc, #4f8cff);
      color: white;
      text-align: center;
      padding: 30px 20px;
    }
    .header h2 {
      margin: 0;
      font-size: 26px;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 30px 25px;
      color: #333;
      line-height: 1.6;
      font-size: 16px;
      text-align: center;
    }
    .content p {
      margin: 15px 0;
    }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 25px;
      background-color: #155dfc;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      transition: 0.3s ease;
    }
    .btn:hover {
      background-color: #0f47c7;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 13px;
      color: #888;
      background-color: #f9fbff;
    }
    .footer a {
      color: #155dfc;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body>

  <div class="container">

<div class="header">
  <h2>Welcome to Test Hive, ${name}! 🎉</h2>
</div>

<div class="content">
  <p>Your account has been successfully created.</p>
  <p>You can now log in and start exploring interactive tests and smart assessments.</p>
  <p>We’re excited to have you on board 🚀</p>

  <a href="https://test-hive-frontend.vercel.app/dashboard" class="btn">
    Go to Dashboard
  </a>

  <p style="margin-top:25px;">Happy Learning Every Day! 😊</p>
</div>

<div class="footer">
  © 2026 Test Hive. All rights reserved.<br><br>
  Visit us: 
  <a href="https://test-hive-frontend.vercel.app/dashboard">
    test-hive-frontend.vercel.app
  </a>
</div>

  </div>

</body>
</html>

    `
  });
};

const sendResultEmail = async ({ email, userName, testTitle, score, totalMarks }) => {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Test Result: ${testTitle}`,
    html: `
      <!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8">
  <title>Test Result</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fb;
      font-family: Arial, sans-serif;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
    }
    .header {
      background: linear-gradient(135deg, #155dfc, #4f8cff);
      color: white;
      text-align: center;
      padding: 30px 20px;
    }
    .header h2 {
      margin: 0;
      font-size: 26px;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 30px 25px;
      color: #333;
      line-height: 1.6;
      font-size: 16px;
      text-align: center;
    }
    .score-box {
      margin: 20px auto;
      padding: 15px;
      background: #f0f5ff;
      border-radius: 10px;
      font-size: 20px;
      font-weight: bold;
      color: #155dfc;
      display: inline-block;
    }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 25px;
      background-color: #155dfc;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      transition: 0.3s ease;
    }
    .btn:hover {
      background-color: #0f47c7;
    }
    .secondary-btn {
      display: inline-block;
      margin-top: 15px;
      padding: 10px 20px;
      background-color: #e6ecff;
      color: #155dfc;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 13px;
      color: #888;
      background-color: #f9fbff;
    }
    .footer a {
      color: #155dfc;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body>

  <div class="container">

<div class="header">
  <h2>Test Result | Test Hive</h2>
</div>

<div class="content">
  <p>Hello ${userName},</p>

  <p>You have completed <strong>${testTitle}</strong>.</p>

  <div class="score-box">
    ${score} / ${totalMarks}
  </div>

  <p>Great effort! Check your detailed performance and insights below 👇</p>

  <a href="https://test-hive-frontend.vercel.app/results" class="btn">
    View Result
  </a>

  <br>

  <p style="margin-top:25px;">Keep learning and improving 🚀</p>
</div>

<div class="footer">
  © 2026 Test Hive. All rights reserved.<br><br>
  Visit us: 
  <a href="https://test-hive-frontend.vercel.app/dashboard">
    test-hive-frontend.vercel.app
  </a>
</div>
  </div>

</body>
</html>

    `
  });
};

const sendReminderEmail = async ({ email, userName, testTitle, duration }) => {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Test Reminder: ${testTitle}`,
    html: `
     <!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8">
  <title>Test Reminder</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fb;
      font-family: Arial, sans-serif;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
    }
    .header {
      background: linear-gradient(135deg, #155dfc, #4f8cff);
      color: white;
      text-align: center;
      padding: 30px 20px;
    }
    .header h2 {
      margin: 0;
      font-size: 26px;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 30px 25px;
      color: #333;
      line-height: 1.6;
      font-size: 16px;
      text-align: center;
    }
    .info-box {
      margin: 20px auto;
      padding: 15px;
      background: #f0f5ff;
      border-radius: 10px;
      display: inline-block;
      color: #155dfc;
      font-weight: bold;
    }
    .btn {
      display: inline-block;
      margin-top: 25px;
      padding: 12px 25px;
      background-color: #155dfc;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      transition: 0.3s ease;
    }
    .btn:hover {
      background-color: #0f47c7;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 13px;
      color: #888;
      background-color: #f9fbff;
    }
    .footer a {
      color: #155dfc;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body>

  <div class="container">
<div class="header">
  <h2>Test Reminder | Test Hive</h2>
</div>

<div class="content">
  <p>Hello ${userName},</p>

  <p>Your test <strong>${testTitle}</strong> is now available.</p>

  <div class="info-box">
    Duration: ${duration} minutes
  </div>

  <p>Log in to your account and give it your best shot! 💪</p>

  <a href="https://test-hive-frontend.vercel.app/dashboard" class="btn">
    Go to Dashboard
  </a>
</div>

<div class="footer">
  © 2026 Test Hive. All rights reserved.<br><br>
  Visit us: 
  <a href="https://test-hive-frontend.vercel.app/dashboard">
    test-hive-frontend.vercel.app
  </a>
</div>
  </div>

</body>
</html>

    `
  });
};

module.exports = {
  createTransporter,
  sendWelcomeEmail,
  sendResultEmail,
  sendReminderEmail
};
