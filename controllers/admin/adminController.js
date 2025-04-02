const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Order = require('../../models/orderSchema');
const moment = require('moment');

const pageerror = async (req, res) => {
  res.render('admin-error');
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin');
  }
  res.render('admin-login', { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });
    if (admin) {
      const passwordMatch = bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect('/admin');
      } else {
        return res.redirect('/login');
      }
    } else {
      return res.redirect('/login');
    }
  } catch (error) {
    console.log('login error', error);
    return res.redirect('/pageerror');
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
       res.render('dashboard', { currentPage: 'dashboard' });
      
    } catch (error) {
      res.redirect('/pageerror');
    }
  }
};
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log('Error destroying session', err);
        return res.redirect('/pageerror');
      }
      res.redirect('/admin/login');
    });
  } catch (error) {
    console.log('Unexpected error during logout', error);
    res.redirect('/pageerror');
  }
};
const getYearlySalesData = async () => {
  // Fetch sales data from your database (modify as per your schema)
  return await Order.aggregate([
    {
      $group: {
        _id: { $year: '$createdAt' },
        totalSales: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const getChartData = async (req, res) => {
  try {
    let { filter } = req.query;

    const endDate = new Date();
    let startDate;

    switch (filter) {
      case 'weekly':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'yearly':
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
    }

    // Fetch orders in the selected period
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' },
    });

    const groupedData = groupByPeriod(orders, filter);

    res.json({
      success: true,
      labels: Object.keys(groupedData),
      values: Object.values(groupedData).map((data) => data.totalSales),
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);

    res
      .status(500)
      .json({ success: false, message: 'Error fetching chart data', error });
  }
};

// Helper function to group data based on filter
function groupByPeriod(orders, period) {
  const grouped = {};

  orders.forEach((order) => {
    const date = moment(order.createdAt);
    let periodKey = '';

    switch (period) {
      case 'weekly':
        periodKey = date.startOf('isoWeek').format('YYYY-MM-DD');
        break;
      case 'monthly':
        periodKey = date.format('YYYY-MM');
        break;
      case 'yearly':
        periodKey = date.format('YYYY');
        break;
    }

    if (!grouped[periodKey]) {
      grouped[periodKey] = { totalSales: 0 };
    }

    grouped[periodKey].totalSales += order.totalAmount || 0;
  });

  return grouped;
}

const getBestSellingData = async (req, res) => {
  try {
    // Fetch Top 10 Best-Selling Products
    const bestSellingProducts = await Order.aggregate([
      { $match: { items: { $ne: [] } } }, // Ignore orders with empty items
      { $unwind: '$items' },
      { $match: { 'items.productId': { $exists: true, $ne: null } } }, // Ensure productId exists
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: '$productDetails.productName',
          price: '$productDetails.salePrice',
          stock: '$productDetails.stock',
          totalSold: 1,
        },
      },
    ]);

    // Fetch Top 10 Best-Selling Categories
    const bestSellingCategories = await Order.aggregate([
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$productDetails.category',
          totalSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      { $unwind: '$categoryDetails' },
      {
        $project: {
          _id: 1,
          categoryName: '$categoryDetails.name',
          totalSold: 1,
        },
      },
    ]);

    const bestSellingBrands = await Order.aggregate([
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$productDetails.brand', // ✅ Group by ObjectId (brand)
          totalSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'brands', // ✅ Lookup brand details
          localField: '_id',
          foreignField: '_id',
          as: 'brandDetails',
        },
      },
      { $unwind: '$brandDetails' },
      {
        $project: {
          _id: 0,
          brandId: '$_id',
          brandName: '$brandDetails.brandName', // ✅ Correct field name
          totalSold: 1,
        },
      },
    ]);

    // Send Response
    res.json({
      success: true,
      bestSellingProducts,
      bestSellingCategories,
      bestSellingBrands,
    });
  } catch (error) {
    console.error('Error fetching best-selling data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
  getChartData,
  getBestSellingData,
};
