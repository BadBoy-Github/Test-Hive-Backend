const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

// Validate critical environment variables
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  console.error('Please set MONGODB_URI in your environment variables');
  // Continue anyway - will fail DB operations
}

if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET not set - authentication may fail');
}

const app = express();

// Configure Mongoose
const isVercel = process.env.VERCEL || process.env.Vercel;
mongoose.set('bufferCommands', true);   // Always buffer for serverless compatibility
mongoose.set('bufferTimeoutMS', 10000); // 10s timeout

// Middleware
app.use(helmet());

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://test-hive-frontend.vercel.app',
      'https://test-hive-backend.vercel.app'
    ];

    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/test-hive-frontend-.*\.vercel\.app$/.test(origin);
    callback(null, isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Server error', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Health check
app.get('/health', (req, res) => {
  const status = mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
  res.json({ 
    status, 
    readyState: mongoose.connection.readyState,
    dbConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

// DB readiness middleware - returns 503 if DB not connected
app.use('/api', (req, res, next) => {
  const readyState = mongoose.connection.readyState;
  if (readyState !== 1) {
    console.log(`🛑 DB not ready (state: ${readyState}) - ${req.method} ${req.path}`);
    return res.status(503).json({ 
      message: 'Database unavailable. Please try again in a few seconds.',
      readyState,
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users', require('./routes/users'));

// Start server immediately (don't wait for DB)
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Database connection with retry
const connectDB = async (retries = 5) => {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`🔄 MongoDB connection attempt ${i}/${retries}...`);
      
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 120000,
        maxPoolSize: isVercel ? 2 : 10,
        minPoolSize: 1,
        connectTimeoutMS: 30000,
        keepAlive: true,
        keepAliveInitialDelay: 300000,
      });

      console.log('✅ MongoDB connected successfully');
      
      // Run migration (skip on Vercel)
      if (!isVercel) {
        try {
          const Test = require('./models/Test');
          const tests = await Test.find({});
          let updated = 0;
          for (const test of tests) {
            try {
              await test.recalculateTotalMarks();
              updated++;
            } catch (err) {
              console.error(`Failed to recalc totalMarks for test ${test._id}:`, err.message);
            }
          }
          if (updated > 0) {
            console.log(`✅ Migration complete: Recalculated totalMarks for ${updated} tests`);
          }
        } catch (err) {
          console.error('Migration error:', err);
        }
      }
      
      return; // Success
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${i} failed:`, err.message);
      if (i < retries) {
        const delay = Math.min(1000 * i * 2, 10000); // Exponential backoff, max 10s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ All MongoDB connection attempts failed. API endpoints will return 503 until DB is available.');
      }
    }
  }
};

// Start DB connection in background
connectDB().catch(err => {
  console.error('Fatal DB connection error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;
