const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
      },
      price: {
        type: Number,
        required: true,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
      status: {
        type: String,
        default: 'placed',
      },
      finalPrice: {
        type: Number,
        required: false,
      },
      cancellationReason: {
        type: String,
        default: 'none',
      },
      pdtOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer', // Reference to the Offer schema
        default: null,
      },
      catOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer', // Reference to the Offer schema
        default: null,
      },
    },
  ],
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
