const express = require('express');
const router = express.Router();
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');

const wishlistAdd = async (req, res) => {
  const userId = req.user._id; // Get the logged-in user ID
  const productId = req.params.productId;

  try {
    console.log(`User ID: ${userId}, Product ID: ${productId}`); // Debugging

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // Check if the product is already in the wishlist
    if (user.wishlist.includes(productId)) {
      console.log('Product already in wishlist. Removing...');
      user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
      await user.save();
      return res.json({
        success: true,
        status: 'removed',
        message: 'Removed from Wishlist',
      });
    } else {
      console.log('Adding product to wishlist...');
      user.wishlist.push(productId);
      await user.save();
      return res.json({
        success: true,
        status: 'added',
        message: 'Added to Wishlist',
      });
    }
  } catch (error) {
    console.error('Error in wishlistAdd:', error);
    res.json({ success: false, message: 'Error updating wishlist' });
  }
};

const toggle = async (req, res) => {
  console.log(req.user); // Debugging line
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized - Please log in' });
  }
  const { productId } = req.body;
  const userId = req.session.userId; // Ensure user is logged in

  if (!userId) {
    return res
      .status(401)
      .json({ message: 'Please log in to add to wishlist' });
  }

  try {
    let user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const index = user.wishlist.indexOf(productId);
    if (index > -1) {
      user.wishlist.splice(index, 1);
      await user.save();
      return res.json({ status: 'removed' });
    } else {
      user.wishlist.push(productId);
      await user.save();
      return res.json({ status: 'added' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const wishlistRemove = async (req, res) => {
  try {
    const userId = req.user._id;
    const productId = req.params.productId;

    console.log(`Removing product ${productId} from user ${userId}'s wishlist`); // Debug log

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });

    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    await user.save();

    console.log('Wishlist updated:', user.wishlist); // Check if it's actually removed
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    console.error('🔥 Error removing from wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};



const getWishlist = async (req, res) => {
  try {
    if (!req.user) {
      console.log('❌ No user found in request!');
      return res
        .status(401)
        .json({ success: false, message: 'User not authenticated' });
    }

    // Fetch user and populate wishlist with all required fields
    const user = await User.findById(req.user._id).populate({
      path: 'wishlist',
      select: 'productName productImage salePrice pdtOffer catOffer stock description size color',
      populate: [
        { path: 'pdtOffer', select: 'discountValue discountType' },
        { path: 'catOffer', select: 'discountValue discountType' }
      ]
    });

    if (!user) {
      console.log('❌ User not found!');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Process wishlist and calculate correct final price
    const wishlistWithPrices = user.wishlist.map(product => {
      const pdtDiscount =
        product.pdtOffer?.discountType === 'percentage' ? product.pdtOffer.discountValue : 0;
      const catDiscount =
        product.catOffer?.discountType === 'percentage' ? product.catOffer.discountValue : 0;

      const maxDiscount = Math.max(pdtDiscount, catDiscount); // Choose the higher discount

      const finalPrice = product.salePrice - (product.salePrice * maxDiscount) / 100;
      
      return {
        ...product.toObject(),
        finalPrice: finalPrice.toFixed(2),
        discountPercent: maxDiscount,
        
      };
    });

    console.log('✅ Wishlist Data Sent to Frontend:', JSON.stringify(wishlistWithPrices, null, 2));

    res.render('wishlist', { wishlist: wishlistWithPrices });
  } catch (error) {
    console.error('🔥 Wishlist Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};




module.exports = {
  getWishlist,
  wishlistAdd,
  wishlistRemove,
  toggle,
};
