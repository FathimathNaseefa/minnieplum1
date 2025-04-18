const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Offer = require('../../models/offerSchema');
const mongoose = require('mongoose');
const { roundToFixedNumber } = require('../../helpers/utils');

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const productId = req.query.id;
    const user=req.session.user || null

    // Fetch product and populate category, pdtOffer, and catOffer
    const product = await Product.findById(productId)
      .populate('brand','brandName')
      .populate('category')
      .populate('pdtOffer', 'discountValue discountType') // Populate product offer
      .populate('catOffer', 'discountValue discountType'); // Populate category offer

     

    const findCategory = product.category;

    // Extract discount values from populated fields
    const pdtOffer = product.pdtOffer || null;
    const catOffer = product.catOffer || null;

    // Calculate product-specific discount
    const pdtDiscount =
      pdtOffer?.discountType === 'percentage' ? pdtOffer.discountValue : 0;

    // Calculate category-specific discount
    const catDiscount =
      catOffer?.discountType === 'percentage' ? catOffer.discountValue : 0;

    // Use the higher of the two discounts
    const discount = Math.max(pdtDiscount, catDiscount);

    //const finalPrice = product.salePrice - product.salePrice * (discount / 100);
    const finalPrice = roundToFixedNumber(
      product.salePrice - (product.salePrice * discount) / 100,
      10
    );
    

    // Calculate the discount percentage
    const discountPercent = Math.round(
      ((product.salePrice - finalPrice) / product.salePrice) * 100
    );

    // Check if the product is wishlisted
    let isWishlisted = false;
    if (userId) {
      const user = await User.findById(userId);
      isWishlisted = user?.wishlist.includes(productId);
    }

    // Fetch recommended products
    const recommendedProducts = await Product.find({
      category: findCategory._id,
      _id: { $ne: product._id },
    }).limit(4);

    // Calculate average rating
    const reviews = product.reviews || [];
    const averageRating = reviews.length
      ? (
          reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        ).toFixed(1)
      : 0;

    // Render the product details page
    res.render('product-details', {
      user: userData,
      product: {
        ...product.toObject(), // Convert Mongoose document to plain object
        finalPrice: finalPrice.toFixed(2), // Add finalPrice to the product object
        discountPercent, // Add discountPercent to the product object
      },
      quantity: product.quantity,
      totalOffer: discount, // Pass the applied discount
      category: findCategory,
      recommendedProducts: recommendedProducts,
      error: null,
      averageRating: averageRating,
      reviews: reviews,
      size: product.size,
      isWishlisted,
      user
    });
  } catch (error) {
    console.error('Error fetching product details', error);
    res.redirect('/pageNotFound');
  }
};


module.exports = {
  productDetails,
};
