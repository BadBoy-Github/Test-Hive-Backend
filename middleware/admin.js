const auth = require('./auth');

const isAdminEmail = (email) => {
  const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
  return adminEmails.includes(email.trim());
};

const admin = (req, res, next) => {
  auth(req, res, () => {
    if (!isAdminEmail(req.user.email)) return res.status(403).json({ message: 'Access denied' });
    next();
  });
};

module.exports = admin;