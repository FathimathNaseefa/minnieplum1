const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discount: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: function (value) {
        return this.discountType === 'percentage' ? value <= 100 : true;
      },
      message: (props) =>
        `Invalid discount value: ${props.value}. Percentage discount cannot exceed 100%.`,
    },
  },
  discountType: { type: String, enum: ['percentage', 'flat'], required: true },
  expiry: { type: Date, required: true },
  usageLimit: { type: Number, default: 1 }, // Number of times a coupon can be used
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
});

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
