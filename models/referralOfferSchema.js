const mongoose = require('mongoose');

const referralOfferSchema = new mongoose.Schema({
  rewardAmount: { type: Number, required: true }, // Amount credited to referrer & referee
  expiry: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
});

module.exports = mongoose.model('ReferralOffer', referralOfferSchema);
