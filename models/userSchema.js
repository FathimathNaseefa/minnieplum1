const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    default: null,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },

  password: {
    type: String,
    required: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },

  isAdmin: {
    type: Boolean,
    default: false,
  },

  cart: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
      },
      size: {
        type: String,
      },
      color: {
        type: String,
      },
      price: {
        type: Number,
        required: false,
      },
      pdtOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer',
        default: null,
      },
      finalPrice: {
        type: Number,
        required: false,
      },
      totalPrice: {
        type: Number,
      },
    },
  ],

  wallet: {
    type: Number,
    default: 0,
  },
  walletHistory: [
    {
      amount: { type: Number, required: true },
      type: { type: String, enum: ['credit', 'debit'], required: true },
      description: { type: String, required: true },
      date: { type: Date, default: Date.now },
    },
  ],

  wishlist: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
  ],
  orderHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
  ],
  createdOn: {
    type: Date,
    default: Date.now,
  },
  referralCode: {
    type: String,
    unique: true,
  },
  referralOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
  redeemed: {
    type: Boolean,
    
  },
  redeemedUsers: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  searchHistory: [
    {
      category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
      brand: {
        type: String,
      },
      searchOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  referredBy:
   { type: mongoose.Schema.Types.ObjectId,
     ref: 'User' 
    },
});

// Generate a unique referral code
userSchema.pre('save', function (next) {
  if (!this.referralCode) {
    this.referralCode = this._id.toString().slice(-6);
  }
  next();
});
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing password');
  }
};

const User = mongoose.model('User', userSchema);
module.exports = User;
