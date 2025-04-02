const mongoose = require('mongoose');
const { Schema } = mongoose;

const userAddressSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', 
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    addressLine1: {
      type: String,
      required: true,
    },
    addressLine2: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false, 
    },
  },
  { timestamps: true }
);

const Address = mongoose.model('UserAddress', userAddressSchema);

module.exports = Address;
