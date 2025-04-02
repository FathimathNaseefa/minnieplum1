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
  discountType: { type: String, enum: ['percentage'] },
  expiry: { type: Date, required: true,index: { expires: 0 }},
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
