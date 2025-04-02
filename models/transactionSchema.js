const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, unique: true, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  transactionType: { type: String, enum: ['credit', 'debit'] },
  amount: Number,
  description: String,
  date: { type: Date, default: Date.now },
  source: { type: String, enum: ['order', 'refund', 'manual'] }, // Example: Order refund, admin top-up
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false,
  }, 
});

module.exports = mongoose.model('Transaction', transactionSchema);
