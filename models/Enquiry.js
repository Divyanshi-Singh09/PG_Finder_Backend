const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema(
  {
    seeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PG',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Please provide an enquiry subject'],
      trim: true,
      maxlength: [120, 'Subject cannot exceed 120 characters'],
    },
    message: {
      type: String,
      required: [true, 'Please provide an enquiry message'],
      trim: true,
      minlength: [5, 'Message must be at least 5 characters long'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: ['PENDING', 'RESPONDED', 'CLOSED'],
      default: 'PENDING',
      index: true,
    },
    ownerReply: {
      type: String,
      default: '',
      trim: true,
    },
    isReadByOwner: {
      type: Boolean,
      default: false,
    },
    isReadBySeeker: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

enquirySchema.index({ seeker: 1, createdAt: -1 });
enquirySchema.index({ owner: 1, createdAt: -1 });
enquirySchema.index({ pg: 1, createdAt: -1 });

module.exports = mongoose.model('Enquiry', enquirySchema);
