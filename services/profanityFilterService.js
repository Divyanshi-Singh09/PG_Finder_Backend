/**
 * Profanity & Content Abuse Filter Service
 */

const BLOCKED_KEYWORDS = [
  'abusive', 'scam', 'fraud', 'illegal', 'threat', 'violence',
  'fake pg', 'stole money', 'worst owner ever'
];

/**
 * Checks text content for profanity, phone numbers, or abusive patterns
 */
const analyzeContent = (textStr = '') => {
  if (!textStr || typeof textStr !== 'string') {
    return { flagged: false, reason: '' };
  }

  const lower = textStr.toLowerCase();

  // Keyword check
  for (const word of BLOCKED_KEYWORDS) {
    if (lower.includes(word)) {
      return {
        flagged: true,
        reason: `Contains flagged keyword: "${word}"`,
      };
    }
  }

  // Regex check for raw phone number dumping (e.g. 10 consecutive digits)
  const phonePattern = /\b[6-9]\d{9}\b/;
  if (phonePattern.test(textStr.replace(/\s+/g, ''))) {
    return {
      flagged: true,
      reason: 'Contains personal contact information.',
    };
  }

  return { flagged: false, reason: '' };
};

module.exports = {
  analyzeContent,
  BLOCKED_KEYWORDS,
};
