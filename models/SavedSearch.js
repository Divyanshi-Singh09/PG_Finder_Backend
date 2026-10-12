const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema(
  {
    seeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide a name for this saved search'],
      trim: true,
      maxlength: [100, 'Search name cannot exceed 100 characters'],
    },
    filters: {
      type: Object,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

savedSearchSchema.index({ seeker: 1, createdAt: -1 });

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
