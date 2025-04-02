const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const mongodb = require('mongodb');

const getCartPage = async (req, res) => {
  try {
    const id = req.session.user;
    const user = await User.findOne({ _id: id });
    const productIds = user.cart.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const oid = new mongodb.ObjectId(id);
    let data = await User.aggregate([
      { $match: { _id: oid } },
      { $unwind: '$cart' },
      {
        $project: {
          proId: { $toObjectId: '$cart.productId' },
          quantity: '$cart.quantity',
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
    let quantity = 0;
    for (const i of user.cart) {
      quantity += i.quantity;
    }
    let grandTotal = 0;
    for (let i = 0; i < data.length; i++) {
      if (products[i]) {
        grandTotal += data[i].productDetails[0].salePrice * data[i].quantity;
      }
      req.session.grandTotal = grandTotal;
    }
    res.render('cart', {
      user,
      quantity,
      data,
      grandTotal,
    });
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};

const addToCart = async (req, res) => {
  try {
    const productId = req.body.productId; // Ensure productId is sent
    const userId = req.session.user._id;

    if (!productId || !userId) {
      return res.json({ status: 'Invalid request' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ status: 'Product not found' });
    }
    if (product.quantity <= 0) {
      return res.json({ status: 'Out of stock' });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // If no cart exists, create one
      cart = new Cart({ userId, items: [] });
    }

    const cartIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (cartIndex === -1) {
      // 🔹 Add new item
      cart.items.push({
        productId,
        quantity: 1,
        price: product.salePrice || product.regularPrice,
        totalPrice: product.salePrice || product.regularPrice,
      });
    } else {
      // 🔹 Update quantity
      const cartItem = cart.items[cartIndex];
      if (cartItem.quantity < product.quantity) {
        cartItem.quantity += 1;
        cartItem.totalPrice = cartItem.quantity * cartItem.price;
      } else {
        return res.json({ status: 'Out of stock' });
      }
    }

    await cart.save(); // 🔥 This ensures items are saved in the database

    return res.json({
      status: true,
      cartLength: cart.items.length,
      user: userId,
    });
  } catch (error) {
    console.error(error);
    return res.redirect('/pageNotFound');
  }
};

const changeQuantity = async (req, res) => {
  try {
    const id = req.body.productId;
    const user = req.session.user;
    const count = req.body.count;
    // count(-1,+1)
    const findUser = await User.findOne({ _id: user });
    const findProduct = await Product.findOne({ _id: id });
    const oid = new mongodb.ObjectId(user);
    if (findUser) {
      // const productExistinCart = findUser.cart.find(
      //   (item) => item.productId === id
      const objectId = new mongodb.ObjectId(id);
      const productExistinCart = findUser.cart.find((item) =>
        item.productId.equals(objectId)
      );

      let newQuantity;
      if (productExistinCart) {
        if (count == 1) {
          newQuantity = productExistinCart.quantity + 1;
        } else if (count == -1) {
          newQuantity = productExistinCart.quantity - 1;
        } else {
          return res
            .status(400)
            .json({ status: false, error: 'Invalid count' });
        }
      } else {
      }
      if (newQuantity > 0 && newQuantity <= findProduct.quantity) {
        let quantityUpdated = await User.updateOne(
          { _id: user, 'cart.productId': id },
          {
            $set: {
              'cart.$.quantity': newQuantity,
            },
          }
        );
        const totalAmount = findProduct.salePrice * newQuantity;

        console.log('User ID:', user); // Check if user ID is correct

        const grandTotal = await User.aggregate([
          { $match: { _id: new mongodb.ObjectId(user) } },
          { $unwind: { path: '$cart', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              proId: { $toObjectId: '$cart.productId' },
              quantity: '$cart.quantity',
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
          {
            $unwind: {
              path: '$productDetails',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $group: {
              _id: null,
              totalPrice: { $sum: '$cart.totalPrice' },
              // $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
            },
          },
        ]);

        console.log('Grand Total Aggregation Result:', grandTotal);

        res.json({
          status: true,
          quantityInput: newQuantity,
          totalAmount: totalAmount,
          grandTotal: grandTotal.length > 0 ? grandTotal[0].totalPrice : 0, // Ensure grandTotal is not undefined
        });
      } else {
        res.json({ status: false, error: 'cart quantity is less' });
      }
    } else {
      res.json({ status: false, error: 'out of stock' });
    }
  } catch (error) {
    res.redirect('/pageNotFound');
    return res.status(500).json({ status: false, error: 'Server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const cartIndex = user.cart.findIndex((item) => item.productId == id);
    user.cart.splice(cartIndex, 1);
    await user.save();
    res.redirect('/cart');
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};

module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
};
