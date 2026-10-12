const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

const { connectDB } = require('./config/db');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/authRoutes');
const pgRoutes = require('./routes/pgRoutes');
const adminRoutes = require('./routes/adminRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const enquiryRoutes = require('./routes/enquiryRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const visitRoutes = require('./routes/visitRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const ownerAnalyticsRoutes = require('./routes/ownerAnalyticsRoutes');
const facilityRoutes = require('./routes/facilityRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const { authRateLimiter, apiRateLimiter, submissionRateLimiter } = require('./middleware/rateLimiter');
const { sanitizationMiddleware } = require('./utils/sanitizer');

// Load environment variables
dotenv.config();

// Connect to MongoDB database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Production Security Headers & Request Correlation ID Middleware
app.use((req, res, next) => {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-ID', reqId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Dynamic CORS Origin Matcher for seamless local development & production
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Requested-With'],
  })
);

app.options('*', cors());

// Cookie Parser Middleware
app.use(cookieParser());

// Body parsing & Input Sanitization middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizationMiddleware);

// Apply Global API Rate Limiter
app.use('/api', apiRateLimiter);

// Mount API routes under /api prefix
app.use('/api', healthRoutes);
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/pgs', pgRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/enquiries', submissionRateLimiter, enquiryRoutes);
app.use('/api/reviews', submissionRateLimiter, reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/visits', submissionRateLimiter, visitRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/reports', submissionRateLimiter, reportRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', submissionRateLimiter, bookingRoutes);
app.use('/api/owner/analytics', ownerAnalyticsRoutes);
app.use('/api/facilities', facilityRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[PGFinder API] Server running on http://localhost:${PORT}`);
});

module.exports = app;
