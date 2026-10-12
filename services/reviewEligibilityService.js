const Review = require('../models/Review');
const Enquiry = require('../models/Enquiry');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');

/**
 * Encapsulated Review Eligibility Verification Service
 */
const checkReviewEligibility = async (seekerId, pgId, memoryEnquiriesParam = [], memoryReviewsParam = []) => {
  if (!seekerId) {
    return { eligible: false, reason: 'NOT_AUTHENTICATED', alreadyReviewed: false };
  }

  // Fallback to internal controller memory array if not passed
  let memoryEnquiries = memoryEnquiriesParam;
  let memoryReviews = memoryReviewsParam;
  if (!memoryEnquiries || memoryEnquiries.length === 0) {
    try {
      memoryEnquiries = require('../controllers/enquiryController').memoryEnquiries || [];
    } catch (e) {}
  }
  if (!memoryReviews || memoryReviews.length === 0) {
    try {
      memoryReviews = require('../controllers/reviewController').memoryReviews || [];
    } catch (e) {}
  }

  if (checkDBConnection()) {
    // 1. Verify PG exists
    const pg = await PG.findOne({ _id: pgId, isDeleted: false });
    if (!pg) {
      return { eligible: false, reason: 'PG_NOT_AVAILABLE', alreadyReviewed: false };
    }

    // 2. Check if already reviewed
    const existingReview = await Review.findOne({ seeker: seekerId, pg: pgId });
    if (existingReview) {
      return { eligible: false, reason: 'ALREADY_REVIEWED', alreadyReviewed: true };
    }

    // 3. Check for completed/closed interaction (Enquiry status CLOSED)
    const closedEnquiry = await Enquiry.findOne({
      seeker: seekerId,
      pg: pgId,
      status: 'CLOSED',
    });

    if (!closedEnquiry) {
      return { eligible: false, reason: 'NO_COMPLETED_INTERACTION', alreadyReviewed: false };
    }

    return { eligible: true, reason: null, alreadyReviewed: false };
  } else {
    // Memory store fallback
    const existingReview = memoryReviews.find(
      (r) => (r.seeker === seekerId || r.seeker?.id === seekerId) &&
             (r.pg === pgId || r.pg?._id === pgId || r.pg?.id === pgId)
    );
    if (existingReview) {
      return { eligible: false, reason: 'ALREADY_REVIEWED', alreadyReviewed: true };
    }

    const closedEnquiry = memoryEnquiries.find(
      (e) => (e.seeker === seekerId || e.seeker?.id === seekerId) &&
             (e.pg === pgId || e.pg?._id === pgId || e.pg?.id === pgId) &&
             e.status === 'CLOSED'
    );

    if (!closedEnquiry) {
      return { eligible: false, reason: 'NO_COMPLETED_INTERACTION', alreadyReviewed: false };
    }

    return { eligible: true, reason: null, alreadyReviewed: false };
  }
};

module.exports = {
  checkReviewEligibility,
};
