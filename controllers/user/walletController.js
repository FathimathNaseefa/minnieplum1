const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const razorpay = require('razorpay');




let instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const addMoneyToWallet = async (req, res) => {
  try {
    var options = {
      amount: req.body.total * 100,
      currency: 'INR',
      receipt: '' + Date.now(),
    };
    instance.orders.create(options, async function (err, order) {
      if (err) {
        console.log('Error while creating order : ', err);
      } else {
        var amount = order.amount / 100;
        console.log(amount);
        await User.updateOne(
          {
            _id: req.session.user,
          },
          {
            $push: {
              history: {
                amount: amount,
                status: 'credit',
                date: Date.now(),
              },
            },
          }
        );
      }
      res.json({ order: order, razorpay: true });
    });
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};

const verify_payment = async (req, res) => {
  try {
    let details = req.body;
    let amount = parseInt(details.order.order.amount) / 100;
    await User.updateOne(
      { _id: req.session.user },
      { $inc: { wallet: amount } }
    );
    res.json({ success: true });
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};




const addMoney = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    // Validate the amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.json({ success: false, message: 'Invalid amount entered' });
    }

    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // Update wallet balance
    user.wallet += parsedAmount;

    // Push transaction history entry
    user.walletHistory.push({
      amount: parsedAmount,
      type: 'credit',
      description: 'Added to Wallet',
      date: new Date(),
    });

    await user.save();

    return res.json({ success: true, message: 'Money added successfully!', newBalance: user.wallet });
  } catch (error) {
    console.error('Error adding money:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};





module.exports = {
  addMoneyToWallet,
  verify_payment,
  addMoney,
}
