/**
 * Lightweight In-Memory Rate Limiting Middleware for Production Security
 */
const rateLimitMap = new Map();

// Periodic cleanup of expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes window
    max = 100, // Max requests per IP in window
    message = 'Too many requests from this IP, please try again later.',
  } = options;

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.baseUrl}${req.path}:${ip}`;
    const now = Date.now();

    let entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitMap.set(key, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000));
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds: Math.ceil((entry.resetTime - now) / 1000),
      });
    }

    next();
  };
};

// Strict rate limiters for sensitive endpoints
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 login/register attempts
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  message: 'API rate limit exceeded. Please slow down your requests.',
});

const submissionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 submissions per minute (enquiries, bookings, reviews)
  message: 'Submission limit reached. Please wait a moment before sending more data.',
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  submissionRateLimiter,
};
