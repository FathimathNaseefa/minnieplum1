const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Brand = require('../../models/brandSchema');
const Swal = require('sweetalert2');
const Offer = require('../../models/offerSchema');
require('dotenv').config();

const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const dns = require("dns");

async function isEmailDomainValid(email) {
  const domain = email.split("@")[1];
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      resolve(!err && addresses && addresses.length > 0);
    });
  });
}


const pageNotFound = async (req, res) => {
  try {
    res.render('404page');
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};

const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    let userData = null;

    if (user) {
      userData = await User.findById(user);
    }

    // Fetch limited products for homepage display
    const products = await Product.find({ isBlocked: false, status: 'Available' })
      .sort({ createdOn: -1 }) // Show latest products first
      .limit(8) // Adjust limit as needed
      .select('productName salePrice productImage brand') // Include brand field
      .populate('brand', 'brandName') // Populate brandName field
      .lean();

    res.render('home', { user: userData, products });
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.status(500).send('Server error');
  }
};


const block = async (req, res) => {
  if (!req.session.user) {
    return res.json({ logout: false }); // Non-logged-in users should not be logged out
  }

  try {
    const user = await User.findById(req.session.user);
    if (!user || user.isBlocked) {
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
        res.clearCookie('connect.sid');
        return res.json({ logout: true });
      });

      return; // Prevent further execution
    }

    res.json({ logout: false });
  } catch (error) {
    console.error('Error checking block status:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


const loadSignup = async (req, res) => {
  try {
    return res.render('signup');
  } catch (error) {
    console.log('Home page not loading');
    res.status(500).send('Server Error');
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    if (!email || email.trim() === "") {
      console.error("❌ Error: No recipient email provided");
      return false;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.USER,
        pass: process.env.PASS,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.USER,
      to: email,
      subject: 'Verify your account',
      text: `Your OTP is:${otp}`,
      html: `<b>Your OTP:${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error('Error sending email', error);
    return false;
  }
}

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {}
};

const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase(); // Generates a random 8-character code
};


// Referral Bonus Amount
const REFERRAL_BONUS = 50;

// Signup Function
const signup = async (req, res) => {
  try {
    const { name, email, phone, password, cPassword, ref } = req.body;


    if (!email || email.trim() === "") {
      return res.render("signup", { message: "Email is required" });
    }


    if (password !== cPassword) {
      return res.render('signup', { message: 'Passwords do not match' });
    }
    console.log("Checking email domain for:", email);

    // ✅ Validate Email Domain
    const isValidDomain = await isEmailDomainValid(email);
    console.log("Email domain valid:", isValidDomain);

    if (!isValidDomain) {
      console.log("❌ Invalid email domain, stopping signup.");
      return res.render("signup", { message: "Invalid email domain. Please use a valid email." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('signup', {
        message: 'User with this email already exists',
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json('email-error');
    }

    req.session.userOtp = otp;
    req.session.userData = { name, email, phone, password, ref };

    res.render('verifyotp');
    console.log(otp);
  } catch (error) {
    console.error('Signup error:', error);
    res.redirect('/pageNotFound');
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp === req.session.userOtp) {
      const { name, email, phone, password, ref } = req.session.userData;
      const passwordHash = await bcrypt.hash(password, 10);

      let referredBy = null;
      let walletBalance = 0;
      let walletHistory = [];

      // Validate referral code and assign ObjectId
      if (ref) {
        const referrer = await User.findOne({ referralCode: ref });
        if (referrer) {
          referredBy = referrer._id; // Store referrer's ID

          // Reward the referrer
          referrer.wallet += REFERRAL_BONUS;
          referrer.walletHistory.push({
            type: 'credit',
            description: `Referral Bonus for referring ${name}`,
            amount: REFERRAL_BONUS,
          });
          await referrer.save();

          // Reward the new user as well
          walletBalance = REFERRAL_BONUS;
          walletHistory.push({
            type: 'credit',
            description: 'Signup Bonus (Referred by ' + referrer.name + ')',
            amount: REFERRAL_BONUS,
          });
        }
      }

      // Create the new user with a valid ObjectId (or null) for referredBy
      const newUser = new User({
        name,
        email,
        phone,
        password: passwordHash,
        referredBy,
        wallet: walletBalance,
        walletHistory,
      });

      await newUser.save();

      req.session.user = newUser._id;
      res.json({ success: true, redirectUrl: '/' });
    } else {
      res
        .status(400)
        .json({ success: false, message: 'Invalid OTP, please try again' });
    }
  } catch (error) {
    console.error('Error Verifying OTP', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: 'Email not found in session' });
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log('Resend OTP:', otp);
      res
        .status(200)
        .json({ success: true, message: 'OTP Resend Successfully' });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP,Please try again',
      });
    }
  } catch (error) {
    console.error('Error resending OTP', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error,Please try again',
    });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render('login');
    } else {
      res.redirect('/');
    }
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};






const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const findUser = await User.findOne({ email });

    if (!findUser) {
      return res.render('login', { message: 'User not found' });
    }

    // Check if the user is blocked
    if (findUser.isBlocked) {
      return res.render('login', { message: 'User is blocked by admin' });
    }

    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render('login', { message: 'Incorrect Password' });
    }

    // Set session data
    req.session.user = findUser._id; // Store user ID
    req.session.email = findUser.email; // Store email
    req.session.name = findUser.name; // Store email
    
    req.session.save(); // Save the session

    
    res.redirect('/'); // Redirect to home after successful login
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { message: 'Login failed. Please try again later' });
  }
};


const logout = async (req, res) => {
  try {
    // Clear session data first
    req.session.user = null;
    req.session.email = null;
    req.session.name = null;
    
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).redirect('/pageNotFound');
      }
      
      // Clear the session cookie
      res.clearCookie('connect.sid'); // or your session cookie name
      
      // Add cache-control headers and redirect
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      return res.redirect('/login');
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).redirect('/pageNotFound');
  }
};

const loadShoppingPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const categories = await Category.find({ isListed: true });

    let selectedCategories = req.query.category
      ? req.query.category.split(',')
      : [];
    const sortOption = req.query.sort || 'createdOn';
    const showOutOfStock = req.query.outOfStock === 'true';
    const searchQuery = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    let query = { isBlocked: false, status: 'Available' };
   

    if (selectedCategories.length > 0) {
      query.category = { $in: selectedCategories };
    }

     let sortCriteria = {};
    

    // Fetch products
    const products = await Product.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .populate('brand', 'brandName')
      .populate('category')
      .populate('pdtOffer', 'discountValue discountType') // Product Offer
      .populate('catOffer', 'discountValue discountType'); // Category Offer


      
console.log("🔍 Populated Products Response:", JSON.stringify(products, null, 2)); // Debugging


    
    

    const updatedProducts = products.map((product) => {
      let salePrice = product.salePrice;
      let pdtDiscount =
        product.pdtOffer?.discountType === 'percentage'
          ? product.pdtOffer.discountValue
          : 0;
      let catDiscount =
        product.catOffer?.discountType === 'percentage'
          ? product.catOffer.discountValue
          : 0;
    
      let discount = Math.max(pdtDiscount, catDiscount);
      let finalPrice = salePrice - salePrice * (discount / 100);
    
      // Convert to plain object and attach final price
      let updatedProduct = product.toObject();
      updatedProduct.finalPrice = Math.round(finalPrice / 10) * 10;
      updatedProduct.discountPercent = Math.round(
        ((salePrice - updatedProduct.finalPrice) / salePrice) * 100
      );
    
      return updatedProduct;
    });
    
    
    

    
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit) || 1; // Ensure at least 1 page
   

    res.render('shop', {
      user: userData,
      // products,
      products: updatedProducts, // Use the modified products list
      categories,
      selectedCategories,
      totalProducts,
      currentPage: page,
      totalPages,
      showOutOfStock,
      sortOption,
      searchQuery,
    });
  } catch (error) {
    console.error('Error loading shopping page:', error);
    res.redirect('/pageNotFound');
  }
};


const getFilteredProducts = async (req, res) => {
  try {
    const { query, categories, sort, outOfStock, page = 1 } = req.query;
    const limit = 9;
    const skip = (page - 1) * limit;

    let filter = { isBlocked: false, status: "Available" };

    if (query) {
      const regexPattern = query.length > 1 ? `(^${query}|${query})` : `^${query}`;
      filter.productName = { $regex: regexPattern, $options: "i" };
    }

    if (outOfStock === "true") {
      filter.stock = 0;
    } else {
      filter.stock = { $gt: 0 };
    }

    if (categories) {
      const categoryIds = categories.split(",").filter(id => /^[0-9a-fA-F]{24}$/.test(id));
      if (categoryIds.length > 0) {
        filter.category = { $in: categoryIds };
      }
    }

    // ✅ Define sorting based on query parameter
    let sortQuery = {};
    switch (sort) {
      case "price_asc": // Low to High
        sortQuery["salePrice"] = 1;
        break;
      case "price_desc": // High to Low
        sortQuery["salePrice"] = -1;
        break;
      case "popularity":
        sortQuery["popularity"] = -1; // Assuming you have a `popularity` field
        break;
      case "ratings":
        sortQuery["averageRating"] = -1; // Assuming you have an `averageRating` field
        break;
      case "a_z":
        sortQuery["productName"] = 1;
        break;
      case "z_a":
        sortQuery["productName"] = -1;
        break;
      default:
        sortQuery["createdAt"] = -1; // Default: Newest first
        break;
    }

    let products = await Product.find(filter)
      .sort(sortQuery) // ✅ Sorting applied at the DB level
      .skip(skip)
      .limit(limit)
      .collation({ locale: "en", strength: 2 }) // Case-insensitive sorting
      .populate("pdtOffer", "discountValue discountType")
      .populate("catOffer", "discountValue discountType");

    products = products.map(product => {
      let salePrice = product.salePrice;
      let discount = Math.max(
        product.pdtOffer?.discountValue || 0,
        product.catOffer?.discountValue || 0
      );

      let finalPrice = salePrice - salePrice * (discount / 100);
      product.finalPrice = Math.round(finalPrice / 10) * 10;
      product.discountPercent = Math.round(((salePrice - product.finalPrice) / salePrice) * 100);
      return product;
    });

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    res.json({ success: true, products, totalPages, currentPage: parseInt(page) });
  } catch (error) {
    console.error("Error fetching filtered products:", error);
    res.status(500).json({ success: false, message: "Error fetching products" });
  }
};



module.exports = {
  loadHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  pageNotFound,
  loadLogin,
  login,
  loadShoppingPage,
  logout,
  getFilteredProducts,
  block
};
