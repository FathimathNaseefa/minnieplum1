const Order = require('../../models/orderSchema'); // Assuming you have an order model
const Cart = require('../../models/cartSchema');
const UserAddress = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const { v4: uuidv4 } = require('uuid');
const Coupon = require('../../models/couponSchema');
const { getDiscountedPrice } = require('../../utils/priceHelper');
const Offer = require('../../models/offerSchema');
const Category = require('../../models/categorySchema');
const Razorpay = require('razorpay');
const paypal = require('paypal-rest-sdk');
require('dotenv').config();
const mongoose = require('mongoose');

function roundToFixedNumber(value, fixedNumber) {
  return Math.round(value / fixedNumber) * fixedNumber;


  
}
function roundToNearestTen(value) {
  return Math.round(value / 10) * 10;
}


const applyCouponDiscount = async (req, totalAmount) => {
  //if (!req.session.appliedCoupon) return totalAmount;
  if (!req.session.appliedCoupon || totalAmount <= 0) return totalAmount;


  // Assuming you have a function to apply the coupon based on the code
  const coupon = await Coupon.findOne({ code: req.session.appliedCoupon });

  if (coupon) {
    const discount = (totalAmount * coupon.discount) / 100;
    return totalAmount - discount; // Apply the discount
  }

  return totalAmount;
};

const getCheckoutPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user).populate(
      'cart.productId'
    );

    if (!user) {
      return res.redirect('/login');
    }

    const addresses = await UserAddress.find({ userId: user._id });

    let totalAmount = req.query.totalAmount
      ? parseFloat(req.query.totalAmount)
      : 0;
    let totalDiscount = 0;
    let originalTotal = 0;
    let productOffers = [];
    let categoryOffers = [];

    console.log('User Cart:', user.cart);

    if (!totalAmount && user.cart.length > 0) {
      console.log('Calculating totals...');

      totalAmount = await user.cart.reduce(async (sumPromise, item) => {
        let sum = await sumPromise;

        if (!item.productId) {
          console.log('Skipping item (no productId):', item);
          return sum;
        }

        console.log('Product Details:', item.productId);

        let salePrice = item.productId.salePrice;
        console.log('Product Price:', salePrice);

        let finalPrice = salePrice;
        let appliedDiscount = 0;

        // Apply Product Offer if available
        if (item.productId.pdtOffer) {
          const pdtOffer = await Offer.findById(item.productId.pdtOffer);
          if (pdtOffer) {
            let discount = (salePrice * pdtOffer.discountValue) / 100;
            let pdtOfferPrice = salePrice - discount;
            if (pdtOfferPrice < finalPrice) {
              finalPrice = pdtOfferPrice;
              appliedDiscount = discount;
              productOffers.push({
                productId: item.productId._id,
                discountValue: pdtOffer.discountValue,
                discountType: pdtOffer.discountType,
              });
            }
          }
        }

        // Apply Category Offer if available
        const category = await Category.findById(
          item.productId.category
        ).populate('catOffer');

        if (category) {
          console.log('Category Found:', category.name);
          console.log('Category Offer:', category.catOffer);

          if (category.catOffer) {
            const catOffer = await Offer.findById(category.catOffer);

            if (catOffer) {
              console.log('Category Offer Details:', catOffer);

              if (
                (catOffer.isActive === undefined || catOffer.isActive) &&
                new Date(catOffer.expiry) > new Date()
              ) {
                let discount = (salePrice * catOffer.discountValue) / 100;
                let catOfferPrice = salePrice - discount;

                if (catOfferPrice < finalPrice) {
                  finalPrice = catOfferPrice;
                  appliedDiscount = discount;

                  categoryOffers.push({
                    categoryId: category._id,
                    discountValue: catOffer.discountValue,
                    discountType: catOffer.discountType,
                  });

                  console.log('✅ Category Offer Applied:', categoryOffers);
                }
              } else {
                console.log('❌ Category Offer Expired or Inactive');
              }
            } else {
              console.log('❌ No Category Offer Found in DB');
            }
          } else {
            console.log('❌ No Category Offer Assigned to Category');
          }
        }

        totalDiscount += appliedDiscount * item.quantity;
        return sum + finalPrice * item.quantity;
      }, Promise.resolve(0));

      originalTotal = totalAmount + totalDiscount;
      console.log('Totals Calculated:', {
        originalTotal,
        totalAmount,
        totalDiscount,
      });
    }

    // Apply coupon discount if any
    totalAmount = await applyCouponDiscount(req, totalAmount);
    originalTotal = totalAmount + totalDiscount;

    let defaultAddress =
      addresses.find((address) => address.isDefault) ||
      (addresses.length > 0 ? addresses[0] : null);
    const appliedCoupon = req.session.appliedCoupon || null;

    // Helper function for rounding
    const roundToFixedNumber = (num, decimals) =>
      parseFloat(num.toFixed(decimals));

    console.log('Final Values:', {
      originalTotal,
      totalAmount,
      totalDiscount,
      productOffers,
      categoryOffers,
      appliedCoupon,
    });

   
    const order = await Order.findOne({
      userId: user._id,
      paymentStatus: 'Pending',
    });


    totalAmount = roundToNearestTen(totalAmount);
originalTotal = roundToNearestTen(originalTotal);
totalDiscount = roundToNearestTen(totalDiscount);


    res.render('checkout', {
      user,
      addresses,
      defaultAddress,
      totalAmount: roundToFixedNumber(totalAmount, 2),
      originalTotal: roundToFixedNumber(originalTotal, 2),
      totalDiscount: roundToFixedNumber(totalDiscount, 2),
      productOffers,
      categoryOffers,
      appliedCoupon,
      order,
      orderId: order ? order.orderId : null, // ✅ Fix here
      roundToFixedNumber, // Pass function to EJS
    });
  } catch (error) {
    console.error('Error loading checkout:', error);
    res.redirect('/pageNotFound');
  }
};



const addAddress = async (req, res) => {
  try {
      const user = req.session.user;
      const { name, addressLine1, city, state, postalCode, country, phoneNumber } = req.body;

      // ✅ Manual validation
      let errors = [];

      if (!name.trim()){ errors.push("Full Name is required.")
      } else if (!/^[A-Za-z\s]+$/.test(name.trim())) {
        errors.push("Full Name must contain only alphabets.");
    }
      if (!addressLine1.trim()) errors.push("Address Line 1 is required.");
      if (!city.trim()) errors.push("City is required.");
      if (!state.trim()) errors.push("State is required.");
      if (!country.trim()) errors.push("Country is required.");
      if (!/^\d{6,}$/.test(postalCode)) errors.push("Postal Code must be at least 6 digits.");
      if (!/^\d{10}$/.test(phoneNumber)) errors.push("Phone Number must be a valid 10-digit number.");

      if (errors.length > 0) {
          return res.status(400).json({ success: false, errors });
      }

      // ✅ Save the address if all validations pass
      const newAddress = new UserAddress({
          userId: user,
          name: name.trim(),
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
          phoneNumber: phoneNumber.trim(),
          isDefault: false,
      });

      await newAddress.save();
      return res.json({ success: true }); // ✅ Success Response
  } catch (error) {
      console.error("Error adding address:", error);
      res.status(500).json({ success: false, errors: ["Internal server error."] });
  }
};






const getEditAddressPage = async (req, res) => {
  try {
    const addressId = req.params.id;
    const address = await UserAddress.findById(addressId);

    if (!address) {
      return res.redirect('/pageNotFound');
    }

    res.render('checkout-editAdd', { address });
  } catch (error) {
    console.error(error);
    res.redirect('/pageNotFound');
  }
};

// Edit an existing address
const editAddress = async (req, res) => {
  try {
    const {
      addressId,
      name,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phoneNumber,
    } = req.body;

    await UserAddress.findByIdAndUpdate(addressId, {
      name,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phoneNumber,
    });

    res.redirect('/checkout');
  } catch (error) {
    console.error(error);
    res.redirect('/pageNotFound');
  }
};

// Set a default address
const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.body;
    const user = req.session.user;

    // Remove default from all addresses
    await UserAddress.updateMany({ userId: user }, { isDefault: false });

    // Set the new default address
    await UserAddress.findByIdAndUpdate(addressId, { isDefault: true });

    res.redirect('/checkout');
  } catch (error) {
    console.error(error);
    res.redirect('/pageNotFound');
  }
};

const orderSuccess = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log('🔹 Fetching order for success page:', orderId);
    let order;

    // Check if orderId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId).populate('shippingAddress');
    } else {
      order = await Order.findOne({ orderId }).populate('shippingAddress');
    }

    if (!order) {
      return res.status(404).send('Order not found.');
    }

    // Calculate estimated delivery (5 days from now)
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

    res.render('order-success', {
      order,
      estimatedDelivery: estimatedDelivery.toDateString(),
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).send('Something went wrong.');
  }
};



const walletPay = async (req, res) => {
  try {
    console.log("🛒 Wallet Payment Request:", req.body);
    
    const userId = req.session.user;
    if (!userId) {
      console.error("❌ User not logged in!");
      return res.status(401).json({ error: "User not logged in" });
    }

    const { shippingAddressId, amount,discount } = req.body; // ✅ Use `amount`
    
    if (!amount) {
      console.error("❌ Missing amount from request!");
      return res.status(400).json({ error: "Amount is required" });
    }

    let user = await User.findById(userId).populate("cart.productId");
    if (!user) {
      console.error("❌ User not found!");
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.cart || user.cart.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    console.log("💰 Final Amount After Discounts:", amount);
    console.log("👤 User Wallet Balance:", user.wallet);

    if (user.wallet < amount) {
      console.log("❌ Insufficient wallet balance.");
      return res.json({ success: false, message: "Insufficient wallet balance." });
    }

    // Deduct from wallet
    user.wallet -= amount;
    user.walletHistory.push({
      date: new Date(),
      type: "debit",
      description: "Order Payment",
      amount,
    });

    // Reduce stock
    for (const item of user.cart) {
      const product = await Product.findById(item.productId._id);
      if (product) {
        product.stock -= item.quantity;
        await product.save();
      }
    }

    // Create order
    let order = new Order({
      orderId: `ORD-${Date.now()}`,
      userId,
      items: user.cart.map((item) => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
        productImage: item.productId.productImage,
      })),
      totalAmount: amount,  // ✅ Use `amount`
      paymentMethod: "Wallet",
      paymentStatus: "Paid",
      status: "Processing",
      shippingAddress: shippingAddressId,
      discount
    });

    await order.save();
    user.cart = [];
    await user.save();

    console.log("✅ Payment successful! Order ID:", order._id);
    res.json({ success: true, message: "Payment successful!", orderId: order._id });
  } catch (error) {
    console.error("🔥 Wallet Payment Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



const createOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, appliedCoupon } = req.body;

    if (!addressId || !paymentMethod) {
      return res.status(400).json({ message: 'Address and payment method are required.' });
    }

    const userId = req.session.user;
    if (!userId) return res.status(400).json({ message: 'User not logged in' });

    const user = await User.findById(userId).populate('cart.productId');
    if (!user) return res.status(400).json({ message: 'User not found' });

    const cart = user.cart;
    if (!cart || cart.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Check stock availability
    for (const item of cart) {
      const product = await Product.findById(item.productId._id);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product?.name || 'an item'}`,
        });
      }
    }

    const selectedAddress = await UserAddress.findById(addressId);
    if (!selectedAddress) {
      return res.status(400).json({ message: 'Invalid shipping address.' });
    }

    // Calculate total before any discounts
    let totalBeforeDiscount = cart.reduce(
      (sum, item) => sum + item.quantity * item.productId.salePrice,
      0
    );
    totalBeforeDiscount = Number(totalBeforeDiscount) || 0;

    // Discount calculation variables
    let totalDiscount = 0;

    for (const item of cart) {
      const product = await Product.findById(item.productId._id);
      if (!product) continue;

      const category = await Category.findById(product.category).populate({
        path: 'catOffer',
        select: 'discountValue expiry'
      });

      // Calculate product offer discount
      let productDiscount = 0;
      if (product.pdtOffer) {
        const productOffer = await Offer.findById(product.pdtOffer);
        if (productOffer) {
          productDiscount = (product.salePrice * productOffer.discountValue) / 100;
        }
      }

      // Calculate category offer discount
      let categoryDiscount = 0;
      if (category?.catOffer) {
        const catOffer = await Offer.findById(category.catOffer);
        if (catOffer && new Date(catOffer.expiry) > new Date()) {
          categoryDiscount = (product.salePrice * catOffer.discountValue) / 100;
        }
      }

      // Apply ONLY the highest discount (either product offer OR category offer)
      let highestDiscount = Math.max(productDiscount, categoryDiscount);
      totalDiscount += highestDiscount * item.quantity;
    }

    // Calculate subtotal after offers
    const subtotalAfterOffers = Math.max(0, totalBeforeDiscount - totalDiscount);

    console.log("💰 Total Before Discount:", totalBeforeDiscount);
    console.log("🛒 Subtotal After Offers:", subtotalAfterOffers);

    // Apply coupon discount
    let couponDiscount = 0;
    let coupon = null;

    if (appliedCoupon) {
      coupon = await Coupon.findOne({ code: appliedCoupon });
      if (coupon) {
        console.log("🎟️ Applied Coupon Code:", appliedCoupon);
        console.log("✅ Coupon Found:", coupon);

        if (coupon.expiry < new Date()) {
          return res.status(400).json({ message: 'Coupon has expired.' });
        }

        const isCouponValidForCart = 
          (coupon.categoryIds.length === 0 && coupon.productIds.length === 0) || 
          cart.some(item => 
            coupon.categoryIds.includes(String(item.productId.category)) || 
            coupon.productIds.includes(String(item.productId._id))
          );

        if (!isCouponValidForCart) {
          return res.status(400).json({ message: 'Coupon does not apply to your cart items.' });
        }

        // Apply coupon discount
        if (coupon.discountType === 'percentage') {
          couponDiscount = (subtotalAfterOffers * coupon.discount) / 100;
        } else if (coupon.discountType === 'flat') {
          couponDiscount = Math.min(coupon.discount, subtotalAfterOffers);
        }

        couponDiscount = Number(couponDiscount) || 0;
      }
    }

    console.log("🎯 Coupon Discount Applied:", couponDiscount);

    // Calculate final total
    const finalTotal = Math.max(0, subtotalAfterOffers - couponDiscount);

    console.log("💰 Final Total After All Discounts:", finalTotal);

    if (isNaN(finalTotal)) {
      console.error("❌ Error: finalTotal is NaN! Debugging values:");
      console.log("totalBeforeDiscount:", totalBeforeDiscount);
      console.log("totalDiscount:", totalDiscount);
      console.log("subtotalAfterOffers:", subtotalAfterOffers);
      console.log("couponDiscount:", couponDiscount);
      return res.status(500).json({ message: "Internal error: invalid total calculation." });
    }

    if (paymentMethod === 'cod' && finalTotal > 1000) {
      return res.status(400).json({
        message: 'Cash on Delivery (COD) is not available for orders above ₹1000.',
      });
    }

    const uniqueOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newOrder = new Order({
      orderId: uniqueOrderId,
      userId,
      shippingAddress: selectedAddress,
      paymentMethod,
      items: cart.map(item => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
        productImage: item.productId.productImage,
      })),
      totalBeforeDiscount: Number(totalBeforeDiscount) || 0,
      discount: Number(totalDiscount + couponDiscount) || 0,
      totalAmount: Number(finalTotal) || 0,
      status: 'Pending',
      couponApplied: coupon?._id || null,
      totalDiscount,
      couponDiscount,
    });

    await newOrder.save();

    console.log("✅ Order Created:", newOrder);

    // Update product stock
    for (const item of cart) {
      const product = await Product.findById(item.productId._id);
      if (product) {
        product.stock -= item.quantity;
        await product.save();
      }
    }

    // Clear user's cart
    user.cart = [];
    await user.save();

    req.session.cart = [];
    await req.session.save();

    return res.redirect(`/order-success/${newOrder._id}`);

  } catch (error) {
    console.error('❌ Order creation error:', error);
    return res.status(500).json({ 
      status: false, 
      error: 'Server error',
      message: error.message 
    });
  }
};



const applyCoupon = async (req, res) => {
  try {
    const { couponCode, totalAmount } = req.body;

    if (!couponCode) {
      return res.json({
        success: false,
        message: 'Please enter a coupon code.',
      });
    }

    // Find coupon in DB
    const coupon = await Coupon.findOne({ code: couponCode });

    if (!coupon) {
      return res.json({ success: false, message: 'Invalid coupon code.' });
    }

    // Check if coupon is expired
    const currentDate = new Date();
    if (coupon.expiry < currentDate) {
      return res.json({ success: false, message: 'Coupon has expired.' });
    }

    let discountAmount = 0;
    let newTotal = totalAmount;

    // Apply Discount Based on Type
    if (coupon.discountType === 'percentage') {
      discountAmount = (totalAmount * coupon.discount) / 100;
    } else if (coupon.discountType === 'flat') {
      discountAmount = coupon.discount;
    }

    newTotal = totalAmount - discountAmount;

    // Prevent negative total and apply minimum amount of 0
    if (newTotal < 0) newTotal = 0;

    // Round the new total and discount for display consistency (optional)
    discountAmount = parseFloat(discountAmount.toFixed(2));
    newTotal = parseFloat(newTotal.toFixed(2));

    return res.json({
      success: true,
      newTotal,
      discountAmount,
      message: 'Coupon applied successfully!',
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const removeCoupon = (req, res) => {
  try {
    const { totalAmount } = req.body; // Ensure this matches frontend
    res.json({
      success: true,
      newTotal: totalAmount,
      message: 'Coupon removed!',
    });
  } catch (error) {
    console.error('Error removing coupon:', error);
    res.status(500).json({ success: false, message: 'Server error!' });
  }
};

module.exports = {
  getCheckoutPage,
  addAddress,
  getEditAddressPage,
  editAddress,
  setDefaultAddress,
  createOrder,
  orderSuccess,
  applyCoupon,
  removeCoupon,
  walletPay,
  
};
