const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  isListed: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  catOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer', // Reference to the Offer schema
    default: null,
  },
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
