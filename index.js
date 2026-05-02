const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

// Validate critical environment variables
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  if (process.env.NODE_ENV === 'production') {
    console.error('Server cannot start without MONGODB_URI in production');
    process.exit(1);
  } else {
    console.warn('⚠️ Running without database (development only)');
  }
}

if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET not set - authentication may fail');
}

const app = express();

// Disable Mongoose buffering - fail fast if DB not ready
mongoose.set('bufferCommands', false);

let dbConnected = false;

// Middleware
app.use(helmet());

// CORS middleware with dynamic origin handling
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
  res.status(500).json({ message: 'Server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const status = mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
  res.json({ status, readyState: mongoose.connection.readyState, timestamp: new Date().toISOString() });
});

// Middleware to wait for DB before API requests (if not connected yet, return 503)
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      message: 'Database connecting... Please try again in a few seconds.',
      readyState: mongoose.connection.readyState
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

// Database connection
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Add connection event listeners for debugging and auto-reconnect
    mongoose.connection.on('connecting', () => console.log('📡 MongoDB connecting...'));
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected');
      dbConnected = true;
    });
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message);
      dbConnected = false;
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected - will attempt to reconnect');
      dbConnected = false;
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (mongoose.connection.readyState !== 1) {
          mongoose.connect(process.env.MONGODB_URI).catch(err => {
            console.error('Reconnection failed:', err.message);
          });
        }
      }, 3000);
    });

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 60000,
      maxPoolSize: 10,
      minPoolSize: 5,
    });

     // Run migration only in local/dev mode (skip on Vercel)
     if (process.env.NODE_ENV !== 'production' || !process.env.Vercel) {
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

    // Start HTTP server only after DB connected
    if (process.env.NODE_ENV !== 'production' || !process.env.Vercel) {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } else {
      // For Vercel serverless
      console.log('Server ready (Vercel)');
    }
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Starting server without DB (dev mode only)');
      app.listen(PORT, () => console.log(`Server running on port ${PORT} (NO DB)`));
    } else {
      console.error('Cannot start without DB in production');
      process.exit(1);
    }
  }
};

startServer();

// Export for Vercel serverless
module.exports = app;
