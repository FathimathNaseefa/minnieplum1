const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['product', 'category', 'referral'],
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false,
  },
  referralCode: {
    type: String,
    required: function () {
      return this.type === 'referral';
    },
  },
  discountValue: { type: Number, required: true },
  discountType: { type: String, enum: ['percentage', 'fixed'] },
  expiry: { type: Date, required: true },
  isActive: { type: Boolean, default: true }, // ✅ New field to track active status
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

// ✅ Automatically update `isActive` based on expiry date before saving
offerSchema.pre('save', function (next) {
  const today = new Date();
  if (this.expiry && new Date(this.expiry) < today) {
    this.isActive = false;
  }
  next();
});

const Offer = mongoose.model('Offer', offerSchema);
module.exports = Offer;
