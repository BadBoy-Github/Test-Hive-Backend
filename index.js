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
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://test-hive-frontend.vercel.app',
        'https://test-hive-backend.vercel.app'
      ];

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is exactly in the list or matches the Vercel preview pattern
      const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/test-hive-frontend-.*\.vercel\.app$/.test(origin);
      
      callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    optionsSuccessStatus: 200
  };

  app.use(cors(corsOptions));

  // Handle preflight requests for all routes
  app.options('*', cors(corsOptions));

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