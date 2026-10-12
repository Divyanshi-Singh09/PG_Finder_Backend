const Review = require('../models/Review');
const ReviewHelpful = require('../models/ReviewHelpful');
const Booking = require('../models/Booking');
const PG = require('../models/PG');
const VerificationAuditLog = require('../models/VerificationAuditLog');
const { checkDBConnection } = require('../config/db');
const { analyzeContent } = require('../services/profanityFilterService');
const { updatePGRatingSummary } = require('../services/ratingAggregationService');
const notificationService = require('../services/notificationService');

// Memory store fallback for local dev
const memoryReviews = [];
const memoryHelpful = [];

/**
 * @desc    Submit a Review for a Completed Booking
 * @route   POST /api/reviews
 * @access  Private (SEEKER)
 */
const createReview = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { bookingId, rating, title = '', comment, categories = {}, images = [] } = req.body;

    if (!bookingId || rating === undefined || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide booking ID, 1-5 star rating, and review comment.',
      });
    }

    const numericRating = parseInt(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be a whole integer value between 1 and 5.',
      });
    }

    if (comment.trim().length < 10 || comment.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Review comment must be between 10 and 2000 characters long.',
      });
    }

    let booking, pg;

    if (checkDBConnection()) {
      booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking record not found.' });

      if (booking.seeker.toString() !== seekerId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only review your own stays.' });
      }

      if (!['COMPLETED', 'ACCEPTED'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: 'Reviews can only be submitted for completed or confirmed stays.',
        });
      }

      // Check existing review
      const existing = await Review.findOne({ booking: bookingId });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted a review for this stay.',
        });
      }

      // Owner Self-Review Prevention
      if (booking.owner.toString() === seekerId.toString()) {
        return res.status(403).json({ success: false, message: 'Property owners cannot submit reviews for their own PGs.' });
      }

      // Profanity Filter Analysis
      const moderation = analyzeContent(comment);
      const initialStatus = moderation.flagged ? 'PENDING_REVIEW' : 'PUBLISHED';

      const review = await Review.create({
        seeker: seekerId,
        owner: booking.owner,
        pg: booking.pg,
        booking: bookingId,
        rating: numericRating,
        categories: {
          cleanliness: Math.min(5, Math.max(1, parseInt(categories.cleanliness) || 5)),
          location: Math.min(5, Math.max(1, parseInt(categories.location) || 5)),
          facilities: Math.min(5, Math.max(1, parseInt(categories.facilities) || 5)),
          valueForMoney: Math.min(5, Math.max(1, parseInt(categories.valueForMoney) || 5)),
          management: Math.min(5, Math.max(1, parseInt(categories.management) || 5)),
          safety: Math.min(5, Math.max(1, parseInt(categories.safety) || 5)),
        },
        title: title.trim(),
        comment: comment.trim(),
        images,
        status: initialStatus,
        moderationReason: moderation.flagged ? moderation.reason : '',
      });

      await updatePGRatingSummary(booking.pg);

      // Audit Log
      await VerificationAuditLog.create({
        entityType: 'REVIEW',
        entityId: review._id,
        action: 'SUBMITTED',
        performedBy: seekerId,
        reason: `Review submitted with rating ${numericRating} stars. Status: ${initialStatus}`,
      });

      // Send Event Notification to Owner
      await notificationService.createNotification({
        recipient: booking.owner,
        type: 'NEW_ENQUIRY',
        title: 'New Guest Review Received!',
        message: `${req.user.name} submitted a ${numericRating}-star review for your property.`,
        entityType: 'REVIEW',
        entityId: review._id,
      });

      return res.status(201).json({
        success: true,
        message: initialStatus === 'PUBLISHED' ? 'Review submitted and published!' : 'Review submitted for moderation approval.',
        data: { review },
      });
    } else {
      const { memoryBookings } = require('./bookingController');
      booking = memoryBookings.find((b) => b._id === bookingId || b.id === bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking record not found.' });

      const actualSeekerId = (booking.seeker?._id || booking.seeker?.id || booking.seeker).toString();
      if (actualSeekerId !== seekerId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only review your own stays.' });
      }

      const existing = memoryReviews.find((r) => r.booking === bookingId || r.booking?._id === bookingId);
      if (existing) {
        return res.status(400).json({ success: false, message: 'You have already submitted a review for this stay.' });
      }

      const moderation = analyzeContent(comment);
      const initialStatus = moderation.flagged ? 'PENDING_REVIEW' : 'PUBLISHED';
      const pgId = booking.pg?._id || booking.pg?.id || booking.pg;
      const ownerId = booking.owner?._id || booking.owner?.id || booking.owner;

      const newReview = {
        _id: `rev-mem-${Date.now()}`,
        id: `rev-mem-${Date.now()}`,
        seeker: seekerId,
        seekerName: req.user.name,
        owner: ownerId,
        pg: pgId,
        booking: bookingId,
        rating: numericRating,
        categories: { cleanliness: 5, location: 5, facilities: 5, valueForMoney: 5, management: 5, safety: 5 },
        title: title.trim(),
        comment: comment.trim(),
        images,
        status: initialStatus,
        helpfulCount: 0,
        reportedCount: 0,
        ownerReply: { text: '', repliedAt: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      memoryReviews.unshift(newReview);
      await updatePGRatingSummary(pgId);

      await notificationService.createNotification({
        recipient: ownerId,
        type: 'NEW_ENQUIRY',
        title: 'New Guest Review Received!',
        message: `${req.user.name} submitted a ${numericRating}-star review for your property.`,
        entityType: 'REVIEW',
        entityId: newReview._id,
      });

      return res.status(201).json({
        success: true,
        message: initialStatus === 'PUBLISHED' ? 'Review submitted and published!' : 'Review submitted for moderation approval.',
        data: { review: newReview },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Published Reviews for a PG with Ratings Summary & Category Averages
 * @route   GET /api/pgs/:pgId/reviews
 * @access  Public / Authenticated
 */
const getPGReviews = async (req, res, next) => {
  try {
    const { pgId } = req.params;
    const { rating, sort = 'newest', page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const summary = await updatePGRatingSummary(pgId);

    if (checkDBConnection()) {
      const filter = { pg: pgId, status: 'PUBLISHED' };
      if (rating && !isNaN(rating)) filter.rating = parseInt(rating);

      const total = await Review.countDocuments(filter);
      let query = Review.find(filter).populate('seeker', 'name profileImage');

      if (sort === 'oldest') query = query.sort({ createdAt: 1 });
      else if (sort === 'highest') query = query.sort({ rating: -1, createdAt: -1 });
      else if (sort === 'lowest') query = query.sort({ rating: 1, createdAt: -1 });
      else if (sort === 'most_helpful') query = query.sort({ helpfulCount: -1, createdAt: -1 });
      else query = query.sort({ createdAt: -1 });

      const rawReviews = await query.skip(skip).limit(limitNum);

      // Check helpful votes if user is logged in
      const currentUserId = req.user ? req.user.id : null;
      const reviews = await Promise.all(
        rawReviews.map(async (r) => {
          const rObj = r.toObject();
          rObj.isVerifiedStay = true; // Tied to valid booking
          if (currentUserId) {
            const hasVoted = await ReviewHelpful.findOne({ review: r._id, user: currentUserId });
            rObj.userVotedHelpful = Boolean(hasVoted);
          } else {
            rObj.userVotedHelpful = false;
          }
          return rObj;
        })
      );

      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: {
          reviews,
          summary,
          pagination: { page: pageNum, limit: limitNum, total, totalPages },
        },
      });
    } else {
      const pId = pgId?._id || pgId?.id || pgId;
      let filtered = memoryReviews.filter(
        (r) => (r.pg === pId || r.pg?._id === pId) && (r.status === 'PUBLISHED' || !r.status)
      );

      if (rating && !isNaN(rating)) filtered = filtered.filter((r) => r.rating === parseInt(rating));

      if (sort === 'oldest') filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      else if (sort === 'highest') filtered.sort((a, b) => b.rating - a.rating);
      else if (sort === 'lowest') filtered.sort((a, b) => a.rating - b.rating);
      else if (sort === 'most_helpful') filtered.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));
      else filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum).map((r) => ({ ...r, isVerifiedStay: true }));
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: {
          reviews: paginated,
          summary,
          pagination: { page: pageNum, limit: limitNum, total, totalPages },
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check Seeker Review Eligibility for a Booking
 * @route   GET /api/reviews/eligibility/:bookingId
 * @access  Private (SEEKER)
 */
const getReviewEligibility = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { bookingId } = req.params;

    if (checkDBConnection()) {
      const booking = await Booking.findById(bookingId);
      if (!booking || booking.seeker.toString() !== seekerId.toString()) {
        return res.status(200).json({ success: true, data: { eligible: false, reason: 'Invalid booking' } });
      }

      const existing = await Review.findOne({ booking: bookingId });
      if (existing) {
        return res.status(200).json({ success: true, data: { eligible: false, alreadyReviewed: true } });
      }

      const isEligible = ['COMPLETED', 'ACCEPTED'].includes(booking.status);
      return res.status(200).json({ success: true, data: { eligible: isEligible, booking } });
    } else {
      const { memoryBookings } = require('./bookingController');
      const booking = memoryBookings.find((b) => b._id === bookingId || b.id === bookingId);
      if (!booking) return res.status(200).json({ success: true, data: { eligible: false } });

      const existing = memoryReviews.find((r) => r.booking === bookingId || r.booking?._id === bookingId);
      if (existing) return res.status(200).json({ success: true, data: { eligible: false, alreadyReviewed: true } });

      return res.status(200).json({ success: true, data: { eligible: true, booking } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle Helpful Vote on a Review
 * @route   POST /api/reviews/:id/helpful
 * @access  Private (Authenticated User)
 */
const toggleHelpful = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (checkDBConnection()) {
      const review = await Review.findById(id);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

      const existingVote = await ReviewHelpful.findOne({ review: id, user: userId });

      if (existingVote) {
        await existingVote.deleteOne();
        review.helpfulCount = Math.max(0, review.helpfulCount - 1);
        await review.save();
        return res.status(200).json({ success: true, message: 'Helpful vote removed.', data: { helpfulCount: review.helpfulCount, voted: false } });
      } else {
        await ReviewHelpful.create({ review: id, user: userId });
        review.helpfulCount += 1;
        await review.save();
        return res.status(200).json({ success: true, message: 'Marked review as helpful.', data: { helpfulCount: review.helpfulCount, voted: true } });
      }
    } else {
      const review = memoryReviews.find((r) => r._id === id || r.id === id);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

      const voteIdx = memoryHelpful.findIndex((v) => v.review === id && v.user === userId);
      if (voteIdx !== -1) {
        memoryHelpful.splice(voteIdx, 1);
        review.helpfulCount = Math.max(0, (review.helpfulCount || 1) - 1);
        return res.status(200).json({ success: true, message: 'Helpful vote removed.', data: { helpfulCount: review.helpfulCount, voted: false } });
      } else {
        memoryHelpful.push({ review: id, user: userId });
        review.helpfulCount = (review.helpfulCount || 0) + 1;
        return res.status(200).json({ success: true, message: 'Marked review as helpful.', data: { helpfulCount: review.helpfulCount, voted: true } });
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Owner Reply to a Review (1 Reply Per Review)
 * @route   PATCH /api/reviews/:id/reply
 * @access  Private (OWNER, ADMIN)
 */
const replyToReview = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { response } = req.body;

    if (!response || response.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Please provide a valid reply message.' });
    }

    let review;
    if (checkDBConnection()) {
      review = await Review.findById(req.params.id);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

      if (req.user.role !== 'ADMIN' && review.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only reply to reviews for your own PGs.' });
      }

      review.ownerReply = {
        text: response.trim(),
        repliedAt: new Date(),
      };
      await review.save();

      // Audit Log
      await VerificationAuditLog.create({
        entityType: 'REVIEW',
        entityId: review._id,
        action: 'OWNER_REPLIED',
        performedBy: ownerId,
        reason: 'Owner submitted response to guest review.',
      });

      // Send Event Notification to Seeker
      await notificationService.createNotification({
        recipient: review.seeker,
        type: 'ENQUIRY_RESPONSE',
        title: 'Landlord Replied to Your Review!',
        message: `The owner responded to your review: "${response.trim()}"`,
        entityType: 'REVIEW',
        entityId: review._id,
      });

      return res.status(200).json({ success: true, message: 'Owner reply posted successfully.', data: { review } });
    } else {
      review = memoryReviews.find((r) => r._id === req.params.id || r.id === req.params.id);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

      const actualOwnerId = (review.owner?._id || review.owner?.id || review.owner).toString();
      if (req.user.role !== 'ADMIN' && actualOwnerId !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only reply to reviews for your own PGs.' });
      }

      review.ownerReply = {
        text: response.trim(),
        repliedAt: new Date().toISOString(),
      };

      const seekerId = (review.seeker?._id || review.seeker?.id || review.seeker).toString();
      await notificationService.createNotification({
        recipient: seekerId,
        type: 'ENQUIRY_RESPONSE',
        title: 'Landlord Replied to Your Review!',
        message: `The owner responded to your review: "${response.trim()}"`,
        entityType: 'REVIEW',
        entityId: review._id || review.id,
      });

      return res.status(200).json({ success: true, message: 'Owner reply posted successfully.', data: { review } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Owner Dashboard Received Reviews
 * @route   GET /api/owner/reviews
 * @access  Private (OWNER, ADMIN)
 */
const getOwnerReviews = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    if (checkDBConnection()) {
      const reviews = await Review.find({ owner: ownerId })
        .sort({ createdAt: -1 })
        .populate('pg', 'name address')
        .populate('seeker', 'name profileImage');

      return res.status(200).json({ success: true, data: { reviews } });
    } else {
      const filtered = memoryReviews.filter(
        (r) => r.owner === ownerId || r.owner?._id === ownerId || r.owner?.id === ownerId || req.user.role === 'ADMIN'
      );
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ success: true, data: { reviews: filtered } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin Review Moderation Queue
 * @route   GET /api/admin/reviews
 * @access  Private (ADMIN)
 */
const getAdminReviews = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const filter = {};
      if (status && status.trim() !== '') filter.status = status.toUpperCase();

      const total = await Review.countDocuments(filter);
      const reviews = await Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('pg', 'name address')
        .populate('seeker', 'name email')
        .populate('owner', 'name email');

      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { reviews, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    } else {
      let filtered = [...memoryReviews];
      if (status && status.trim() !== '') filtered = filtered.filter((r) => r.status === status.toUpperCase());

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { reviews: paginated, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin Update Review Status (PUBLISHED, HIDDEN, REMOVED, RESTORED)
 * @route   PATCH /api/admin/reviews/:id/status
 * @access  Private (ADMIN)
 */
const moderateReviewStatus = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { status, moderationReason = '' } = req.body;

    if (!status || !['PUBLISHED', 'HIDDEN', 'REMOVED', 'PENDING_REVIEW'].includes(status.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid moderation status.' });
    }

    let review;
    if (checkDBConnection()) {
      review = await Review.findById(req.params.id);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

      review.status = status.toUpperCase();
      review.moderatedBy = adminId;
      review.moderatedAt = new Date();
      if (moderationReason) review.moderationReason = moderationReason.trim();

      await review.save();
      await updatePGRatingSummary(review.pg);

      await VerificationAuditLog.create({
        entityType: 'REVIEW',
        entityId: review._id,
        action: status.toUpperCase(),
        performedBy: adminId,
        reason: moderationReason,
      });

      return res.status(200).json({ success: true, message: `Review status set to ${status.toUpperCase()}.`, data: { review } });
    } else {
      review = memoryReviews.find((r) => r._id === req.params.id || r.id === req.params.id);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

      review.status = status.toUpperCase();
      if (moderationReason) review.moderationReason = moderationReason.trim();

      const pgId = review.pg?._id || review.pg?.id || review.pg;
      await updatePGRatingSummary(pgId);

      return res.status(200).json({ success: true, message: `Review status set to ${status.toUpperCase()}.`, data: { review } });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getPGReviews,
  getReviewEligibility,
  toggleHelpful,
  replyToReview,
  getOwnerReviews,
  getAdminReviews,
  moderateReviewStatus,
  memoryReviews,
  memoryHelpful,
};
