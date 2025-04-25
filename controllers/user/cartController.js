const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const mongodb = require('mongodb');
const { getDiscountedPrice } = require('../../utils/priceHelper');
const Offer = require('../../models/offerSchema'); // ✅ Import Offer model
const Category = require('../../models/categorySchema');
//const { roundToFixedNumber } = require('../../helpers/utils');

const mongoose = require('mongoose');

const roundToFixedNumber = (num, nearest) => Math.round(num / nearest) * nearest;



const getCartPage = async (req, res) => {
  try {
    const id = req.session.user;
    const user = await User.findById(id);

    const oid = new mongodb.ObjectId(id);
    let data = await User.aggregate([
      { $match: { _id: oid } },
      { $unwind: '$cart' },
      {
        $project: {
          proId: { $toObjectId: '$cart.productId' },
          quantity: '$cart.quantity',
          size: '$cart.size',
          color: '$cart.color',
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'proId',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
    ]);

    let grandTotal = 0;

    // Filter out invalid products that no longer exist
    data = data.filter(
      (item) => item.productDetails && item.productDetails.length > 0
    );

    for (let item of data) {
      const product = item.productDetails[0];
      let finalPrice = product.salePrice;

      // ✅ Apply Product Offer if available
      if (product.pdtOffer) {
        const pdtOffer = await Offer.findById(product.pdtOffer);
        if (pdtOffer) {
          let discount = (product.salePrice * pdtOffer.discountValue) / 100;
          let pdtOfferPrice = product.salePrice - discount;
          finalPrice = pdtOfferPrice < finalPrice ? pdtOfferPrice : finalPrice;
        }
      }

      // ✅ Apply Category Offer if available
      const category = await mongoose
        .model('Category')
        .findById(product.category)
        .populate('catOffer');
      if (category && category.catOffer) {
        const catOffer = await Offer.findById(category.catOffer);
        if (catOffer) {
          let discount = (product.salePrice * catOffer.discountValue) / 100;
          let catOfferPrice = product.salePrice - discount;
          finalPrice = catOfferPrice < finalPrice ? catOfferPrice : finalPrice;
        }
      }

      // item.finalPrice = finalPrice;
      item.finalPrice = roundToFixedNumber(finalPrice, 10);

      grandTotal += finalPrice * item.quantity;
      grandTotal = roundToFixedNumber(grandTotal, 10);
    }

    // Remove items from cart if the product is no longer available
    await User.updateOne(
      { _id: oid },
      {
        $pull: {
          cart: { productId: { $nin: data.map((item) => item.proId) } },
        },
      }
    );

    // Handle case if there are no valid items in the cart
    if (data.length === 0) {
      return res.render('cart', {
        user,
        data: [],
        grandTotal: 0,
        roundToFixedNumber,
        cartData: [],
      });
    }

    let cartData = req.user.cart;
    

    // Send the response to the cart page
    res.render('cart', {
      user,
      data,
      grandTotal,
      roundToFixedNumber,
      cartData,
      
    });
  } catch (error) {
    console.error('Error loading cart:', error);
    res.redirect('/pageNotFound');
  }
};



const addToCart = async (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.json({ status: false, message: 'User not logged in' });
    }

    const findUser = await User.findById(userId);
    if (!findUser) {
      return res.json({ status: false, message: 'User not found' });
    }

    const product = await Product.findById(productId)
      .populate('pdtOffer')
      .populate('category')
      .populate('brand') // ⭐️ Add this to check isBlocked in brand
      .lean();

    if (!product) {
      return res.json({ status: false, message: 'Product not found' });
    }

    // ❌ Block if product or brand is blocked or category is unlisted
    if (
      product.isBlocked ||
      !product.category?.isListed ||
      product.brand?.isBlocked // ⭐️ Check brand block status
    ) {
      return res.json({ status: false, message: 'This product is currently unavailable.' });
    }

    if (!product.stock || product.stock <= 0) {
      return res.json({ status: false, message: 'Out of stock' });
    }

    let price = product.salePrice || product.regularPrice;
    let discountAmount = 0;
    let finalPrice = price;
    let pdtOffer = null;

    if (product.pdtOffer && product.pdtOffer.isActive) {
      discountAmount = (price * product.pdtOffer.discountValue) / 100;
      finalPrice = price - discountAmount;
      pdtOffer = product.pdtOffer._id;
    }

    finalPrice = Math.round(finalPrice / 10) * 10;

    const cartIndex = findUser.cart.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.size === size &&
        item.color === color
    );

    if (cartIndex === -1) {
      if (parseInt(quantity) > product.stock) {
        return res.json({ status: false, message: 'Out of stock' });
      }

      findUser.cart.push({
        productId: new mongoose.Types.ObjectId(productId),
        quantity: parseInt(quantity) || 1,
        size,
        color,
        price,
        finalPrice,
        totalPrice: finalPrice * (parseInt(quantity) || 1),
        pdtOffer,
      });
    } else {
      const productInCart = findUser.cart[cartIndex];
      const newQuantity = productInCart.quantity + (parseInt(quantity) || 1);

      if (newQuantity > product.stock) {
        return res.json({ status: false, message: 'Out of stock' });
      }

      findUser.cart[cartIndex].quantity = newQuantity;
      findUser.cart[cartIndex].totalPrice = finalPrice * newQuantity;
    }

    await findUser.save();

    req.session.cart = findUser.cart;
    await req.session.save();

    return res.json({
      status: true,
      cartLength: findUser.cart.length,
      user: userId,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
};




const changeQuantity = async (req, res) => {
  try {
    const id = req.body.productId;
    const user = req.session.user;
    const count = parseInt(req.body.count, 10);

    if (isNaN(count)) {
      return res.json({ status: false, error: 'Invalid count value' });
    }

    const findUser = await User.findOne({ _id: user });
    const findProduct = await Product.findOne({ _id: id });

    if (!findUser) {
      return res.json({ status: false, error: 'User not found' });
    }
    if (!findProduct) {
      return res.json({ status: false, error: 'Product not found' });
    }

    // Find product in user's cart
    const productExistinCart = findUser.cart.find(
      (item) => item.productId.toString() === id.toString()
    );

    if (!productExistinCart) {
      return res.json({ status: false, error: 'Product not in cart' });
    }

    let newQuantity = productExistinCart.quantity + count;

    // Enforce minimum quantity (1)
    if (newQuantity <= 0) {
      return res.json({
        status: false,
        error: 'Quantity cannot be less than 1',
      });
    }

    // Enforce max quantity per person
    if (newQuantity > findProduct.maxPerPerson) {
      return res.json({
        status: false,
        error: `Maximum ${findProduct.maxPerPerson} units allowed per person.`,
      });
    }

    // Ensure stock availability
    if (newQuantity > findProduct.stock) {
      return res.json({ status: false, error: 'Insufficient stock' });
    }

    // Update the cart quantity in the database
    await User.updateOne(
      { _id: user, 'cart.productId': id },
      { $set: { 'cart.$.quantity': newQuantity } }
    );

    // Calculate the grand total of all cart items using finalPrice
    const grandTotalResult = await User.aggregate([
      { $match: { _id: new mongodb.ObjectId(user) } },
      { $unwind: '$cart' },
      {
        $lookup: {
          from: 'products',
          localField: 'cart.productId',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: null,
          totalPrice: {
            $sum: {
              $multiply: ['$cart.quantity', '$productDetails.finalPrice'],
            },
          },
        },
      },
    ]);

    // const updatedGrandTotal =
    //   grandTotalResult.length > 0 ? grandTotalResult[0].totalPrice : 0;

    const updatedGrandTotal =
  grandTotalResult.length > 0
    ? roundToFixedNumber(grandTotalResult[0].totalPrice, 10)
    : 0;


    // Update session with the new grand total
    req.session.grandTotal = updatedGrandTotal;

    return res.json({
      status: true,
      quantity: newQuantity,
      grandTotal: updatedGrandTotal,
    });
  } catch (error) {
    console.error('Error in changeQuantity:', error);
    return res
      .status(500)
      .json({ status: false, error: 'Internal server error' });
  }
};


const deleteProduct = async (req, res) => {
  try {
      const productId = req.query.id || req.body.productId; // ✅ Support both GET & POST
      const userId = req.session.user;

      if (!productId) {
          return res.status(400).json({ status: false, error: "Product ID is required" });
      }

      const user = await User.findById(userId);
      if (!user) {
          return res.status(404).json({ status: false, error: "User not found" });
      }

      if (!user.cart || user.cart.length === 0) {
          return res.status(404).json({ status: false, error: "Cart is empty" });
      }

      // ✅ Convert ObjectId to string for comparison
      const cartIndex = user.cart.findIndex((item) => item.productId.toString() === productId);

      if (cartIndex === -1) {
          return res.status(404).json({ status: false, error: "Product not found in cart" });
      }

      // Remove the item from the cart
      user.cart.splice(cartIndex, 1);
      await user.save();

      // ✅ Fetch product details again to ensure correct `finalPrice`
      const updatedCart = await User.aggregate([
          { $match: { _id: user._id } },
          { $unwind: '$cart' },
          {
              $project: {
                  proId: { $toObjectId: '$cart.productId' },
                  quantity: '$cart.quantity'
              }
          },
          {
              $lookup: {
                  from: 'products',
                  localField: 'proId',
                  foreignField: '_id',
                  as: 'productDetails'
              }
          }
      ]);

      let grandTotal = 0;

      for (let item of updatedCart) {
          if (item.productDetails.length > 0) {
              const product = item.productDetails[0];
              let finalPrice = product.salePrice;

              // ✅ Apply Product Offer
              if (product.pdtOffer) {
                  const pdtOffer = await Offer.findById(product.pdtOffer);
                  if (pdtOffer) {
                      let discount = (product.salePrice * pdtOffer.discountValue) / 100;
                      let pdtOfferPrice = product.salePrice - discount;
                      finalPrice = pdtOfferPrice < finalPrice ? pdtOfferPrice : finalPrice;
                  }
              }

              // ✅ Apply Category Offer
              const category = await mongoose
                  .model('Category')
                  .findById(product.category)
                  .populate('catOffer');
              if (category && category.catOffer) {
                  const catOffer = await Offer.findById(category.catOffer);
                  if (catOffer) {
                      let discount = (product.salePrice * catOffer.discountValue) / 100;
                      let catOfferPrice = product.salePrice - discount;
                      finalPrice = catOfferPrice < finalPrice ? catOfferPrice : finalPrice;
                  }
              }

              grandTotal += finalPrice * item.quantity;
              grandTotal = roundToFixedNumber(grandTotal, 10);

          }
      }

      res.json({ status: true, cartEmpty: updatedCart.length === 0, grandTotal });

  } catch (error) {
      console.error("Error deleting cart item:", error);
      res.status(500).json({ status: false, error: "Failed to remove item" });
  }
};



const checkCart = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ exists: false, message: "User not logged in" });
    }

    const userId = req.session.user;
    const { productId, checkAll, quantity } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ exists: false, message: "User not found" });
    }

    if (checkAll) {
      const wishlistProducts = user.wishlist.map(item => item.productId.toString());
      const cartProducts = user.cart.map(item => item.productId.toString());
      const allInCart = wishlistProducts.every(pid => cartProducts.includes(pid));
      return res.json({ allInCart });
    }

    const cartItem = user.cart.find(item => item.productId.toString() === productId);
    const product = await Product.findById(productId);

    if (!product || product.isBlocked) {
      return res.json({
        exists: false,
        outOfStock: true,
        message: "This product is currently unavailable."
      });
    }

    const cartQuantity = cartItem ? cartItem.quantity : 0;
    const maxAllowedQuantity = 5;
    const availableStock = product.stock;

    // 1. Already reached max allowed quantity (5)
    if (cartQuantity >= maxAllowedQuantity) {
      return res.json({
        exists: true,
        stockFullyAdded: true,
        availableStock,
        message: `Maximum limit reached in cart. You can only add up to ${maxAllowedQuantity} units of this product.`
      });
    }

    // 2. Already added all available stock
    if (cartQuantity >= availableStock) {
      return res.json({
        exists: true,
        stockFullyAdded: true,
        availableStock,
        message: `You have already added all available stock to your cart.`
      });
    }

    // 3. Trying to add more than available stock
    if (cartQuantity + quantity > availableStock) {
      const allowedToAdd = availableStock - cartQuantity;
      return res.json({
        exists: true,
        stockFullyAdded: false,
        availableStock,
        message: `Only ${allowedToAdd} more unit(s) available in stock.`
      });
    }

    // 4. Trying to add more than max allowed quantity
    if (cartQuantity + quantity > maxAllowedQuantity) {
      const allowedMore = maxAllowedQuantity - cartQuantity;
      return res.json({
        exists: true,
        stockFullyAdded: false,
        availableStock,
        message: `Limit exceeded. You can only add ${allowedMore} more unit(s).`
      });
    }

    // 5. All good, item can be added
    return res.json({
      exists: !!cartItem,
      stockFullyAdded: false,
      availableStock,
      cartQuantity
    });

  } catch (error) {
    console.error("🔥 Check Cart Error:", error);
    return res.status(500).json({ exists: false, message: "Server error" });
  }
};





const validateCart=async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId)
      .populate('cart.productId')
      .populate({ path: 'cart.productId', populate: ['category', 'brand'] });

    if (!user) return res.json({ valid: false, message: 'User not found' });

    let cartUpdated = false;

    user.cart = user.cart.filter(item => {
      const product = item.productId;
      const isValid = product &&
        !product.isBlocked &&
        product.stock > 0 &&
        product.category?.isListed &&
        !product.brand?.isBlocked;

      if (!isValid) cartUpdated = true;
      return isValid;
    });

    if (cartUpdated) {
      await user.save();
      return res.json({ valid: false, message: "Some unavailable items were removed from your cart." });
    }

    return res.json({ valid: true });

  } catch (err) {
    console.error("🔥 Cart validation error:", err);
    return res.status(500).json({ valid: false, message: "Server error during validation." });
  }
}




module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
  checkCart,
  validateCart,
};
