const Order = require('../../models/orderSchema'); // Your Order model
const moment = require('moment');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

exports.report = (req, res) => {
  res.render('sales-report', { currentPage: 'sales-report' });
};

exports.getSalesReportData = async (req, res) => {
  try {
    let { startDate, endDate, period } = req.body;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid date range' });
    }

    startDate = new Date(startDate);
    endDate = new Date(endDate);
    endDate.setHours(23, 59, 59, 999);

    console.log(
      `Fetching sales report for: ${startDate} to ${endDate}, Period: ${period}`
    );

    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' },
    });

    console.log(`Orders found: ${orders.length}`);

    const groupedData = groupByPeriod(orders, period);

    res.json({ success: true, data: groupedData });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Error fetching report data', error });
  }
};





// Helper function to group orders
function groupByPeriod(orders, period) {
  const grouped = {};

  orders.forEach((order) => {
    const date = moment(order.createdAt);
    let periodKey = '';

    switch (period) {
      case 'daily':
        periodKey = date.format('YYYY-MM-DD');
        break;
      case 'weekly':
        periodKey = date.startOf('week').format('YYYY-WW');
        break;
      case 'yearly':
        periodKey = date.format('YYYY');
        break;
      default:
        periodKey = date.format('YYYY-MM-DD');
        break;
    }

    if (!grouped[periodKey]) {
      grouped[periodKey] = { totalOrders: 0, totalSales: 0, totalDiscount: 0 };
    }

    grouped[periodKey].totalOrders += 1;
    grouped[periodKey].totalSales += order.totalAmount || 0;
    grouped[periodKey].totalDiscount += order.discount || 0;
  });

  return grouped;
}

exports.downloadPDF = async (req, res) => {
  try {
    // Fetch date range from query parameters
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid date range' });
    }

    // Convert to Date objects
    startDate = new Date(startDate);
    endDate = new Date(endDate);
    endDate.setHours(23, 59, 59, 999); // Ensure full-day inclusion

    console.log(`Generating PDF for: ${startDate} to ${endDate}`);

    // Fetch orders within date range
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' },
    });

    console.log(`Found ${orders.length} orders`);

    // Calculate totals
    const totalOrders = orders.length;
    const totalSales = orders.reduce(
      (acc, order) => acc + order.totalAmount,
      0
    );
    const totalDiscount = orders.reduce(
      (acc, order) => acc + order.discount,
      0
    );

    // Ensure 'public' directory exists
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const pdfPath = path.join(publicDir, 'sales-report.pdf');
    const doc = new PDFDocument({ margin: 30 });

    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // **PDF Header**
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc
      .fontSize(12)
      .text(
        `Date Range: ${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`,
        { align: 'center' }
      );
    doc.moveDown(2);

    // **Summary**
    doc.fontSize(14).text(`Total Orders: ${totalOrders}`);
    doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`);
    doc.text(`Total Discount: ₹${totalDiscount.toFixed(2)}`);
    doc.moveDown(2);

    // **Order Details Table**
    doc.fontSize(12).text('Order Details:', { underline: true });
    doc.moveDown();

    orders.forEach((order, index) => {
      doc.text(`Order ID: ${order._id}`);
      doc.text(`Date: ${moment(order.createdAt).format('YYYY-MM-DD HH:mm')}`);
      doc.text(`Total Amount: ₹${order.totalAmount.toFixed(2)}`);
      doc.text(`Discount: ₹${order.discount.toFixed(2)}`);
      doc.text(`------------------------------------`);
      doc.moveDown();
    });

    doc.end();

    writeStream.on('finish', () => {
      res.download(pdfPath);
    });

    writeStream.on('error', (error) => {
      console.error('Error writing PDF:', error);
      res.status(500).json({ success: false, message: 'Error generating PDF' });
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error generating PDF', error });
  }
};

// Generate Excel Report
exports.downloadExcel = async (req, res) => {
  try {
    const orders = await Order.find({ status: { $ne: 'Cancelled' } });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 },
      { header: 'Discount', key: 'discount', width: 15 },
    ];

    orders.forEach((order) => {
      worksheet.addRow({
        orderId: order._id,
        date: moment(order.createdAt).format('YYYY-MM-DD'),
        totalAmount: order.totalAmount,
        discount: order.discount,
      });
    });

    const filePath = path.join(__dirname, '../public/sales-report.xlsx');
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Error generating Excel', error });
  }
};
