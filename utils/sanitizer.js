/**
 * Input Sanitization Utility for Defense Against XSS Script Injection & NoSQL Operators
 */

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '') // Remove <script> tags
    .replace(/<[^>]*>?/gm, '') // Strip raw HTML tags
    .replace(/\0/g, ''); // Remove null bytes
};

const sanitizeInput = (data) => {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeInput(item));
  }

  if (typeof data === 'object') {
    const sanitized = {};
    for (const key of Object.keys(data)) {
      // Remove dangerous NoSQL operators (keys starting with $)
      if (key.startsWith('$')) {
        continue;
      }
      sanitized[key] = sanitizeInput(data[key]);
    }
    return sanitized;
  }

  return data;
};

const sanitizationMiddleware = (req, res, next) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
};

module.exports = {
  sanitizeString,
  sanitizeInput,
  sanitizationMiddleware,
};
