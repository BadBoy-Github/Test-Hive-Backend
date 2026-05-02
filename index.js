const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

// Environment detection
const isVercel = process.env.VERCEL || process.env.Vercel;
console.log('🔧 Environment: NODE_ENV=' + process.env.NODE_ENV + ' isVercel=' + isVercel);

// Validate MONGODB_URI
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI not set');
  if (process.env.NODE_ENV === 'production' && !isVercel) process.exit(1);
} else {
  // Validate URI format and check for placeholders
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      console.error('❌ Invalid MONGODB_URI format. Must start with mongodb:// or mongodb+srv://');
    }
    if (!/\/\/([^:]+):([^@]+)@/.test(uri)) {
      console.error('❌ MONGODB_URI missing or invalid credentials');
    }
    if (uri.includes('<username>') || uri.includes('<password>') || uri.includes('<cluster>')) {
      console.error('❌ MONGODB_URI contains placeholder values. Replace with real credentials.');
    }
    console.log('✅ MONGODB_URI format validation passed');
  } catch (e) {
    console.error('URI validation error:', e.message);
  }
}
    if (!/\/\/([^:]+):([^@]+)@/.test(uri)) {
      console.error('❌ MONGODB_URI missing credentials');
    }
  } catch (e) {
    console.error('URI validation error:', e.message);
  }
}

if (!process.env.JWT_SECRET) console.warn('⚠️ JWT_SECRET not set');

const app = express();

// Mongoose
mongoose.set('bufferCommands', true);
mongoose.set('bufferTimeoutMS', 10000);

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    const allowed = ['http://localhost:5173','http://localhost:3000','https://test-hive-frontend.vercel.app','https://test-hive-backend.vercel.app'];
    if (!origin) return cb(null, true);
    cb(null, allowed.includes(origin) || /^https:\/\/test-hive-frontend-.*\.vercel\.app$/.test(origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Origin','X-Requested-With','Content-Type','Accept','Authorization'],
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// Health endpoints
app.get('/health', (req, res) => {
  res.json({
    status: mongoose.connection.readyState === 1 ? 'connected' : 'connecting',
    readyState: mongoose.connection.readyState,
    dbConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString(),
    env: { NODE_ENV: process.env.NODE_ENV, isVercel }
  });
});
app.get('/ping', (req, res) => res.json({ pong: true }));

// DB readiness middleware (only non-Vercel)
if (!isVercel) {
  app.use('/api', (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connecting...',
        readyState: mongoose.connection.readyState,
        timestamp: new Date().toISOString()
      });
    }
    next();
  });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users', require('./routes/users'));

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

// Connection events
mongoose.connection.on('connecting', () => console.log('📡 MongoDB connecting...'));
mongoose.connection.on('connected', () => console.log('✅ MongoDB connected'));
mongoose.connection.on('error', err => console.error('❌ MongoDB error:', err.message));
mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));

// Connect with retry
const connectDB = async (attempt = 1) => {
  const maxAttempts = 5;
  try {
    console.log(`🔄 MongoDB attempt ${attempt}/${maxAttempts}...`);
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 120000,
      maxPoolSize: isVercel ? 2 : 10,
      minPoolSize: 1,
      connectTimeoutMS: 30000,
      keepAlive: true,
      keepAliveInitialDelay: 300000,
    });
    console.log('✅ MongoDB connected');
    // Migration: recalculate totalMarks for tests that haven't been calculated yet
    try {
      const Test = require('./models/Test');
      const testsToUpdate = await Test.find({
        $or: [
          { totalMarks: { $exists: false } },
          { totalMarks: 0 }
        ]
      });
      let count = 0;
      for (const t of testsToUpdate) {
        await t.recalculateTotalMarks();
        count++;
      }
      if (count) console.log(`✅ Migrated totalMarks for ${count} tests`);
      else console.log('✅ All tests already have totalMarks up-to-date');
    } catch (e) {
      console.error('Migration error:', e.message);
    }
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    if (err.code) console.error('   Code:', err.code);
    if (err.serverSelection) console.error('   Detail:', err.serverSelection.errmsg || err.serverSelection);
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * attempt * 2, 10000);
      console.log(`⏳ Retrying in ${delay}ms...`);
      setTimeout(() => connectDB(attempt + 1), delay);
    } else {
      console.error('❌ All attempts failed. Will retry every 30s');
      setInterval(() => connectDB(1), 30000);
    }
  }
};

connectDB();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => {
    mongoose.connection.close(false, () => process.exit(0));
  });
});

module.exports = app;
