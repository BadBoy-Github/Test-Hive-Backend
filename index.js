const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

dotenv.config();

const app = express();

// Load balancing with cluster
if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
  console.log(`Primary ${process.pid} is running`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Middleware
  app.use(helmet());

  // CORS middleware with dynamic origin handling
  app.use((req, res, next) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://test-hive-frontend.vercel.app',
      'https://test-hive-frontend-*.vercel.app', // Allow any Vercel preview deployments
      'https://test-hive-backend.vercel.app'
    ];

    const origin = req.headers.origin;

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (allowedOrigins.includes(origin) || origin.match(/https:\/\/test-hive-frontend.*\.vercel\.app/)) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  });

  app.use(express.json());

  // Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/tests', require('./routes/tests'));
  app.use('/api/attempts', require('./routes/attempts'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/notifications', require('./routes/notifications'));

  // Database connection
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}