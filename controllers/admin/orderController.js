const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const mongodb = require('mongodb');
const mongoose = require('mongoose');
const env = require('dotenv').config();
const crypto = require('crypto');

const { v4: uuidv4 } = require('uuid');

const getOrderListPageAdmin = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('userId') // Populate userId field
      .sort({ createdAt: -1 }); // Sort by createdOn in descending order

    let itemsPerPage = 5;
    let currentPag = parseInt(req.query.page) || 1;
    let startIndex = (currentPag - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(orders.length / itemsPerPage);

    // Filter orders to remove ones with missing users
    const validOrders = orders.filter((order) => order.userId !== null);
    const currentOrder = validOrders.slice(startIndex, endIndex);

    res.render('order-list', { orders: currentOrder, totalPages, currentPage:'orderList',currentPag });
  } catch (error) {
    console.error(error);
    res.redirect('/pageerror');
  }
};


const changeOrderStatus = async (req, res) => {
  try {
    console.log('🔥 Request received for /changeOrderStatus');
    console.log('🔹 Request Body:', req.body);

    const { orderId, status } = req.body;

    if (!orderId || !status) {
      console.log('❌ Missing orderId or status');
      return res.status(400).json({ error: 'Missing orderId or status.' });
    }

    await Order.updateOne({ _id: orderId }, { status });

    console.log(`✅ Order ${orderId} status updated to ${status}`);

    return res
      .status(200)
      .json({ message: 'Order status updated successfully!' }); // ✅ Send success response
  } catch (error) {
    console.error('❌ Error updating order status:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};




const getOrderDetailsPageAdmin = async (req, res) => {
  try {
    const orderId = req.query.id;
    console.log('Received Order ID:', orderId);

    let findOrder;
    if (orderId.startsWith('order_rcptid_')) {
      findOrder = await Order.findOne({ orderId })
        .populate('userId', 'name email phone') 
        .populate('items.productId', 'productName salePrice productImage category') // Populating product details
        .populate('shippingAddress')  // Populating shipping address, assuming it's a reference to UserAddress
        .exec();
    } else {
      findOrder = await Order.findById(orderId)
        .populate('userId', 'name email phone')
        .populate('items.productId', 'productName salePrice productImage category')
        .populate('shippingAddress')  // Populating shipping address
        .exec();
    }

    if (!findOrder) {
      console.log('Order not found!');
      return res.redirect('/pageerror');
    }

    if (!findOrder.items?.length) {
      console.log('Order has no items!');
      return res.redirect('/pageerror');
    }

    // Calculate total discount per item, ensuring we use the correct stored discount
    let totalItemPrice = findOrder.items.reduce((sum, item) => sum + item.price, 0);
    let perItemDiscount = findOrder.discount && findOrder.items.length 
      ? findOrder.discount / findOrder.items.length 
      : (findOrder.totalAmount < totalItemPrice 
          ? (totalItemPrice - findOrder.totalAmount) / findOrder.items.length 
          : 0 );

    // Ensure finalPrice is correctly calculated for all payment methods
    findOrder.items.forEach(item => {
      let originalPrice = item.price || item.productId.salePrice;
      let discountedPrice = originalPrice - perItemDiscount;
      item.finalPrice = Math.max(0, discountedPrice).toFixed(2);
    });

    console.log("Final Processed Order:", findOrder);

    // Render the 'order-details-admin' view with populated order details
    res.render('order-details-admin', {
      orders: findOrder,
      orderId: orderId,
      finalAmount: findOrder.totalAmount, 
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.redirect('/pageerror');
  }
};










// 🛒 Place Order (Only COD)
const placeOrder = async (req, res) => {
  try {
    const { userId, products } = req.body;
    let totalAmount = 0;

    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        return res
          .status(400)
          .json({ error: `Insufficient stock for ${product?.name}` });
      }

      totalAmount += product.price * item.quantity;
      product.stock -= item.quantity; // ✅ Reduce stock when order is placed
      await product.save();
    }

    const newOrder = new Order({
      userId,
      products,
      totalAmount,
      paymentStatus: 'Pending',
      orderStatus: 'Pending',
      payment: 'cod', // ✅ Only COD Payment
    });

    await newOrder.save();
    res.json({ message: 'Order placed successfully', order: newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body; // Extract orderId from the request body

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const findOrder = await Order.findOne({ _id: orderId });

    if (!findOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (findOrder.status === 'Cancelled') {
      return res
        .status(400)
        .json({ error: 'This order has already been cancelled.' });
    }

    findOrder.status = 'Cancelled';
    await findOrder.save();

    // Restore product stock
    for (const productData of findOrder.items) {
      // Use `items` instead of `products`
      const product = await Product.findById(productData._id);
      if (product) {
        product.stock += productData.quantity;
        await product.save();
      }
    }

    return res.status(200).json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get Inventory Page
const getInventory = async (req, res) => {
  try {
    const inventory = await Product.find().select(
      'productName size color stock'
    );
    res.render('inventory', { inventory, currentPage: 'inventory' });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/dashboard');
  }
};



const updateStock = async (req, res) => {
  try {
    const { productId, newStock } = req.body;

    if (!productId || isNaN(newStock) || newStock < 0) {
      return res.status(400).json({ error: 'Invalid stock value or product ID' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { stock: newStock },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json({ message: 'Stock updated successfully' });
  } catch (err) {
    console.error('Stock update error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};


const getReturnRequests = async (req, res) => {
  try {
    const returnOrders = await Order.find({
      status: 'Return Requested',
    }).populate('userId');
    res.render('admin/returnRequests', { returnOrders });
  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const acceptReturn = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const order = await Order.findById(orderId);

    // Find the specific product in the order and update its return status
    const productIndex = order.items.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (productIndex === -1) {
      return res.status(404).json({ message: 'Product not found in order.' });
    }

    order.items[productIndex].returnStatus = 'Accepted'; // Add a returnStatus field to your schema
    await order.save();

    res.redirect(`/admin/order-details/${orderId}`);
  } catch (error) {
    console.error('Error accepting return:', error);
    res.redirect('/admin/orders');
  }
};

const rejectReturn = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const order = await Order.findById(orderId);

    // Find the specific product in the order and update its return status
    const productIndex = order.items.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (productIndex === -1) {
      return res.status(404).json({ message: 'Product not found in order.' });
    }

    order.items[productIndex].returnStatus = 'Rejected'; // Add a returnStatus field to your schema
    await order.save();

    res.redirect(`/admin/order-details/${orderId}`);
  } catch (error) {
    console.error('Error rejecting return:', error);
    res.redirect('/admin/orders');
  }
};

const Transaction = require('../../models/transactionSchema');



const returnStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  console.log('📌 Received orderId:', orderId);
  console.log('📌 Received status:', status);

  try {
    // Find and update order status
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      { status },
      { new: true }
    ).populate({ path: 'userId', select: 'wallet walletHistory' }); // ✅ Ensure wallet fields are populated

    if (!updatedOrder) {
      console.log('❌ Order not found.');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    console.log('✅ Order updated:', updatedOrder);

    // ✅ If return is accepted, process refund for Razorpay, COD, and Wallet payments
    if (
      status === 'Return accepted' &&
      ['razorpay', 'cod', 'wallet'].includes(updatedOrder.paymentMethod.toLowerCase())
    ) {
      const user = updatedOrder.userId;

      if (!user) {
        console.log('❌ User not found for order:', updatedOrder._id);
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      console.log('👤 User found:', user._id);
      console.log('💰 User Wallet Before Refund:', user.wallet);

      const refundAmount = updatedOrder.totalAmount;
      const roundedRefundAmount = Math.round(refundAmount / 10) * 10; // Round to nearest 10

      console.log('💵 Original Refund Amount:', refundAmount);
      console.log('💰 Rounded Refund Amount (nearest 10):', roundedRefundAmount);

      if (!roundedRefundAmount || roundedRefundAmount <= 0) {
        console.log('❌ Invalid refund amount.');
        return res.status(400).json({ success: false, message: 'Invalid refund amount.' });
      }

      // ✅ Ensure wallet is a number
      user.wallet = (user.wallet || 0) + roundedRefundAmount;

      // ✅ Ensure walletHistory is initialized
      if (!Array.isArray(user.walletHistory)) {
        user.walletHistory = [];
      }

      // ✅ Create refund transaction
      const walletTransaction = {
        amount: roundedRefundAmount,
        type: 'credit',
        description: `Refund for returned order #${updatedOrder._id}`,
        date: new Date(),
      };

      console.log('🔄 Adding refund transaction to wallet history...');
      user.walletHistory.push(walletTransaction);

      // ✅ Save updated user wallet details
      console.log('🔄 Saving updated wallet...');
      await user.save(); // 🔥 Ensure this is executed
      console.log('✅ Wallet updated. New Balance:', user.wallet);

      // ✅ Save refund transaction in Transactions collection
      const refundTransaction = new Transaction({
        transactionId: `txn_${Date.now()}`, // Generate unique transactionId
        user: user._id,
        transactionType: 'credit',
        amount: roundedRefundAmount,
        description: `Refund for returned order #${updatedOrder._id}`,
        date: new Date(),
        source: 'refund',
        orderId: updatedOrder._id,
      });

      await refundTransaction.save();
      console.log('✅ Refund transaction saved:', refundTransaction);

      return res.json({
        success: true,
        message: `Return approved. ₹${roundedRefundAmount} has been credited to your wallet.`,
        walletBalance: user.wallet,
        order: updatedOrder,
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('❌ Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};






const orderDetails = async (req, res) => {
  try {
    console.log("✅ orderDetails controller triggered");
    const orderId = req.params.id;
    console.log("---Received Order ID:", orderId); // Check if correct ID is received

    // Find the order and populate user and product details
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone') // Fetch user details
      .populate('items.product', 'name price'); // Fetch product details
      
    


    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    console.log("Fetched Order:", JSON.stringify(order, null, 2));

     res.render('admin/orderDetails', { order }); // Send data to admin EJS page
    
    
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// 📌 Export Functions
module.exports = {
  getOrderListPageAdmin,
  changeOrderStatus,
  getOrderDetailsPageAdmin,
  placeOrder,
  cancelOrder,
  getInventory,
  updateStock,
  rejectReturn,
  acceptReturn,
  returnStatus,
  orderDetails,
};
