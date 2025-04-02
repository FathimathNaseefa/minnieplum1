const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const { userAuth, adminAuth } = require('../middlewares/auth');
const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController');
const couponController = require('../controllers/admin/couponController');
const offerController1 = require('../controllers/admin/offerController1');
const brandController = require('../controllers/admin/brandController');
const salesReportController = require('../controllers/admin/salesReportController');
const walletController = require('../controllers/admin/walletController');
const multer = require('multer');
const storage = require('../helpers/multer');
const uploads = multer({ storage: storage });



//admin dashboard management
router.get('/pageerror', adminController.pageerror);
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/', adminAuth, adminController.loadDashboard);
router.get('/logout', adminController.logout);
router.get('/chart-data', adminAuth, adminController.getChartData);
router.get('/best-selling-data', adminController.getBestSellingData);



//customer management
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unblockCustomer', adminAuth, customerController.customerunBlocked);



//category management
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.post(
  '/addCategoryOffer',
  adminAuth,
  categoryController.addCategoryOffer
);
router.post(
  '/removeCategoryOffer',
  adminAuth,
  categoryController.removeCategoryOffer
);
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/unlistCategory', adminAuth, categoryController.getUnlistCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryController.editCategory);
router.post(
  '/deleteCategory/:id',
  adminAuth,
  categoryController.deleteCategory
);



//brand management
router.get('/brand', adminAuth, brandController.getBrandPage);
router.post('/addBrand', adminAuth, brandController.addBrand);
router.get('/blockBrand', adminAuth, brandController.blockBrand);
router.get('/unBlockBrand', adminAuth, brandController.unBlockBrand);
router.get('/deleteBrand', adminAuth, brandController.deleteBrand);


//product Management
router.get('/addProducts', adminAuth, productController.getProductAddPage);
router.post(
  '/addProducts',
  adminAuth,
  uploads.array('images', 4),
  productController.addProducts
);
router.get('/products', adminAuth, productController.getAllProducts);
router.post('/addProductOffer', adminAuth, productController.addProductOffer);
router.post(
  '/removeProductOffer',
  adminAuth,
  productController.removeProductOffer
);
router.get('/blockProduct', adminAuth, productController.blockProduct);
router.get('/unblockProduct', adminAuth, productController.unblockProduct);
router.get('/editProduct', adminAuth, productController.getEditProduct);
router.post(
  '/editProduct/:id',
  adminAuth,
  uploads.array('images', 4),
  productController.editProduct
);
router.post('/deleteImage', adminAuth, productController.deleteSingleImage);
router.post('/deleteProduct/:id', adminAuth, productController.deleteProduct);



//Order Management
router.get('/orderList', adminAuth, orderController.getOrderListPageAdmin);
router.get(
  '/orderDetails',
  adminAuth,
  orderController.getOrderDetailsPageAdmin
);
router.post('/changeOrderStatus', adminAuth, orderController.changeOrderStatus);
router.post('/cancelOrder', adminAuth, orderController.cancelOrder);
router.get('/placeOrder', adminAuth, orderController.placeOrder);
router.put('/orders/:orderId/status', orderController.returnStatus);
router.get('/orders/:id', adminAuth, orderController.orderDetails);



// Inventory Management Routes
router.get('/inventory', adminAuth, orderController.getInventory);
router.post('/update-stock', adminAuth, orderController.updateStock);



//offer managemnt
router.get('/offers1', offerController1.listOffers1);
router.get('/product-offers', offerController1.getProductOffers);
router.post('/add-product-offer', offerController1.addProductOffer);
router.post('/delete-product-offer', offerController1.deleteProductOffer);



// Category Offers
router.get('/category-offers', offerController1.getCategoryOffers);
router.post('/add-category-offer', offerController1.addCategoryOffer);
router.post('/delete-category-offer', offerController1.deleteCategoryOffer);



//coupon
router.get('/coupon', couponController.listCoupons);
router.get('/add-coupon', couponController.getAddCouponPage);
router.post('/add-coupon', couponController.createCoupon);
router.delete('/delete-coupon/:id', couponController.deleteCoupon);




//salesController
router.get('/sales-report', adminAuth, salesReportController.report);
router.post('/sales-report-data', salesReportController.getSalesReportData);
router.get('/download-report/pdf', salesReportController.downloadPDF);
router.get('/download-report/excel', salesReportController.downloadExcel);




//wallet management
router.get('/wallet', adminAuth, walletController.getWallet);
router.get(
  '/wallet/transaction/:id',
  adminAuth,
  walletController.transactionId
);






module.exports = router;
