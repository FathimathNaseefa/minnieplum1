const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new mongoose.Schema({
  orderId: {
     type: String, 
     unique: true, 
     required: true 
    },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  shippingAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAddress',
    required: false,
  },
  paymentMethod: { type: String, required: true },
  discount: { type: Number, default: 0 },
  
  razorpay_payment_id: { type: String, default: null },
  cancellationReason: { type: String, default: null },
  razorpay_order_id: { type: String, default: null, sparse: true },
  returnReason: String,
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending',
  },
  status: {
    type: String,
    enum: [
      'Pending',
      'Processing',
      'Cancelled',
      'Delivered',
      'Return Requested',
      'Returned',
      'Return Accepted',
      'Return Rejected',
    ],
    default: 'Pending',
  },
  appliedReferralOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: null,
  },
  returnStatus: { type: String, default: 'None' },
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
