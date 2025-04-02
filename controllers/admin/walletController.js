const Transaction = require('../../models/transactionSchema');



const getWallet = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalTransactions = await Transaction.countDocuments();
    const totalPages = Math.ceil(totalTransactions / limit);

    const transactions = await Transaction.find()
      .populate('user', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Using lean() for performance

    // Debugging: Log transaction dates before formatting
    console.log("Raw Transactions:", transactions);

    transactions.forEach(transaction => {
      if (transaction.date) {
        try {
          const parsedDate = new Date(transaction.date);
          if (!isNaN(parsedDate.getTime())) {
            transaction.date = parsedDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }); // Example: "Mar 30, 2025"
          } else {
            console.error("Invalid Date:", transaction.date);
            transaction.date = "N/A"; // Handle invalid dates
          }
        } catch (error) {
          console.error("Date Conversion Error:", error);
          transaction.date = "N/A"; // Fallback for errors
        }
      } else {
        transaction.date = "N/A"; // Handle missing date field
      }
    });

    res.render('admin-wallet', {
      transactions,
      currentPage: 'Wallet',
      totalPages,
      currentPageNum: page,
    });
  } catch (error) {
    console.error("Error Fetching Transactions:", error);
    res.status(500).send('Error fetching transactions');
  }
};




const transactionId = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('user')
      .lean();
    if (!transaction) return res.status(404).send('Transaction not found');

    res.render('admin-transaction-details', {
      transaction,
      currentPage: 'Wallet',
    });
  } catch (error) {
    res.status(500).send('Error fetching transaction details');
  }
};

module.exports = {
  getWallet,
  transactionId,
};
