const mongoose = require('mongoose');
const { Schema } = mongoose;

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, required: true },
  comment: { type: String, required: false },
});

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand', // ✅ Reference the Brand collection
      required: false,
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      default: true,
    },

    color: {
      type: [String],
      required: true,
    },
    size: {
      type: [String],
    },
    productImage: {
      type: [String],
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    maxPerPerson: { 
      type: Number, 
      required: true, 
      default: 5 
    },
    status: {
      type: String,
      enum: ['Available', 'Soldout', 'Discountinued'],
      required: true,
      default: 'Available',
    },
    reviews: [reviewSchema],
    stock: {
      type: Number,
      required: true,
      min: 0,
    },
    pdtOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer', // Reference to the Offer schema
      default: null,
    },
    catOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer', 
      default: null,
    },
    finalPrice: {
      type: Number,
      required: false,
    },

    specifications: mongoose.Schema.Types.Mixed,

    highlights: {
      type: [String],
    },
    
    recommendedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
