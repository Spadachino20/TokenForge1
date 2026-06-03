const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { runMigrations } = require('./config/migrate');
  const errorHandler = require('./middleware/errorHandler');
  const { generalLimiter } = require('./middleware/rateLimit');
  const authRoutes = require('./routes/auth');
  const billingRoutes = require('./routes/billing');
  const apiRoutes = require('./routes/api');
  const waitlistRoutes = require('./routes/waitlist');
  const usageRoutes = require('./routes/usage');
  const adminRoutes = require('./routes/admin');
  const app = express();
  const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
    }
  }
}));
app.use(cors());
app.use(generalLimiter);

// Body parsing — webhook needs raw body BEFORE json middleware
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/auth', authRoutes);
app.use('/billing', billingRoutes);
app.use('/v1', apiRoutes);
app.use('/usage', usageRoutes);
app.use('/admin', adminRoutes);
app.use('/', waitlistRoutes);

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling
app.use(errorHandler);

// Start server after migrations
runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`TokenForge server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('Failed to run migrations:', err);
  process.exit(1);
});

module.exports = app;
