const mongoose = require('mongoose');

const themeSchema = new mongoose.Schema(
  {
    phase: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

themeSchema.index({ start_date: 1, end_date: 1 });
themeSchema.index({ phase: 1 });

themeSchema.pre('validate', function validateRange(next) {
  if (this.start_date && this.end_date && this.start_date > this.end_date) {
    this.invalidate('end_date', 'end_date must be on or after start_date');
  }
  next();
});

module.exports = mongoose.model('Theme', themeSchema);
