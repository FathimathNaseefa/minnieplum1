const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const session = require('express-session');
const Address = require('../../models/addressSchema');
const user = require('./userController');
const Order = require('../../models/orderSchema');
require('dotenv').config();

function generateOtp() {
  const digits = '1234567890';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
      },
    });

    const mailOptions = {
      from: 'naseefabroto@gmail.com',
      to: email,
      subject: 'Your otp for email change',
      text: `Your OTP is:${otp}`,
      html: `<b>Your OTP:${otp}</b>`,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email', error);
    return false;
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {}
};

const getForgotPassPage = async (req, res) => {
  try {
    res.render('forgot-password');
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};


const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if email is provided
    if (!email) {
      return res.render('forgot-password', {
        errorMessage: 'Please enter your email address.',
      });
    }

    // Find user with the provided email
    const findUser = await User.findOne({ email: email });

    if (!findUser) {
      return res.render('forgot-password', {
        errorMessage: 'User with this email does not exist.',
      });
    }

    // Generate OTP
    const otp = generateOtp();

    // Send OTP to user's email
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render('forgot-password', {
        errorMessage: 'Failed to send OTP. Please try again.',
      });
    }

    // Store OTP & email in session for verification
    req.session.userOtp = otp;
    req.session.email = email;

    console.log('OTP:', otp); // Debugging (remove in production)

    // Redirect to OTP input page
    res.render('forgotPass-otp', {
      message: 'OTP has been sent to your email.',
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    res.redirect('/pageNotFound');
  }
};



const verifyForgotPassOtp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;
    if (enteredOtp === req.session.userOtp) {
      return res.json({
        success: true,
        redirectUrl: '/reset-password', // Ensure this matches your route
      });
    } else {
      return res.json({
        success: false,
        message: 'OTP not matching',
      });
    }
  } catch (error) {
    console.error('Error in verifyChangePassOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred, please try again later',
    });
  }
};

const getResetPassPage = async (req, res) => {
  try {
    res.render('reset-password');
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};
const getUpdatePage = async (req, res) => {
  try {
    // Ensure the user is logged in
    if (!req.session.user) {
      return res.redirect('/login'); // Redirect to login if session is missing
    }

    // Fetch the user data
    const user = await User.findById(req.session.user);
    if (!user) {
      return res.redirect('/pageNotFound');
    }

    res.render('new-email', {
      userData: req.session.userData,
      currentEmail: user.email, // Pass the current email
      message: '',
      successMessage: req.session.successMessage || '',
    });

    // Clear success message after rendering
    req.session.successMessage = '';
  } catch (error) {
    console.error('Error in getUpdateEmail:', error);
    res.redirect('/pageNotFound');
  }
};

const resendOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    const email = req.session.email;

    console.log('Resendimg OTP to email', email);
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      req.session.userOtp = otp; // Update session with new OTP
      console.log('Resend OTP sent:', otp);

      return res.json({
        success: true,
        message: 'Resed otp successful.',
      });
    } else {
      return res.json({
        success: false,
        message: 'Failed to send OTP. Please try again.',
      });
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.',
    });
  }
};

const postNewPassword = async (req, res) => {
  try {
    const { newPass1, newPass2 } = req.body;
    const email = req.session.email;
    if (newPass1 === newPass2) {
      const passwordHash = await securePassword(newPass1);
      await User.updateOne(
        { email: email },
        { $set: { password: passwordHash } }
      );
      res.redirect('/login');
    } else {
      res.render('reset-password', { message: 'Password do not match' });
    }
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};



const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId).lean();
    const addressData = await Address.find({ userId });

    // 🟢 Orders Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);

    const userOrders = await Order.find({ userId })
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // 🟢 Wallet History Pagination
    const walletPage = parseInt(req.query.walletPage) || 1;
    const walletLimit = 5; // 5 transactions per page
    const totalWalletEntries = userData.walletHistory.length;
    const totalWalletPages = Math.ceil(totalWalletEntries / walletLimit);

    // 🟢 Use `.slice()` to paginate wallet transactions
    const walletHistoryPaginated = userData.walletHistory
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort newest first
      .slice((walletPage - 1) * walletLimit, walletPage * walletLimit);

    console.log("Wallet Page:", walletPage);
    console.log("Total Wallet Pages:", totalWalletPages);
    console.log("Showing Transactions:", walletHistoryPaginated);
    const baseUrl = req.protocol + "://" + req.get("host");

    res.render("profile", {
      user: userData,
      userAddresses: addressData,
      userOrders,
      walletHistory: walletHistoryPaginated, // 🟢 Pass paginated data

      // 🟢 Orders Pagination Variables
      currentPage: page,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,

      // 🟢 Wallet Pagination Variables
      walletCurrentPage: walletPage,
      walletTotalPages: totalWalletPages,
      walletHasPrev: walletPage > 1,
      walletHasNext: walletPage < totalWalletPages,
      walletPrevPage: walletPage - 1,
      walletNextPage: walletPage + 1,
      baseUrl
    });
  } catch (error) {
    console.error("Error retrieving profile data:", error);
    res.redirect("/pageNotFound");
  }
};





const changeEmail = async (req, res) => {
  try {
    

    res.render('change-email');
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};




const changeEmailValid = async (req, res) => {
  try {
    const email = req.body.new_email; // updated field name
    console.log('Email received from form:', email);

    // Check if email is already taken
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.render('change-email', {
        message: 'Email already exists.',
      });
    }

    // Email is available — send OTP
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      req.session.email = email; // save the new email
      res.render('change-email-otp', {
        successMessage: 'OTP sent successfully!',
      });
      console.log('Email sent to:', email);
      console.log('Generated OTP:', otp);
    } else {
      res.render('change-email', {
        message: 'Failed to send OTP. Try again.',
      });
    }
  } catch (error) {
    console.error('Error in changeEmailValid:', error);
    res.redirect('/pageNotFound');
  }
};





const verifyEmailOtp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;
    const sessionOtp = req.session.userOtp;
    const newEmail = req.session.email;

    if (enteredOtp === sessionOtp) {
      const userId = req.session.user;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User session expired or not found',
        });
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { email: newEmail },
        { new: true }
      );

      // Update session email after email change
      req.session.email = newEmail; // This should ensure the email is updated in session

      // Clear OTP data
      req.session.userOtp = null;

      return res.json({
        success: true,
        redirectUrl: '/userProfile',
      });
    } else {
      return res.json({
        success: false,
        message: 'OTP not matching',
      });
    }
  } catch (error) {
    console.error('Error in verifyEmailOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.',
    });
  }
};






const resendEmailOtp = async (req, res) => {
  try {
    const email = req.session.email;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email not found in session' });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log('Resend OTP:', otp);
      return res.status(200).json({ success: true, message: 'OTP Resent Successfully' });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again' });
    }
  } catch (error) {
    console.error('Error resending OTP', error);
    return res.status(500).json({ success: false, message: 'Internal server error. Please try again' });
  }
};




const changePassword = async (req, res) => {
  
  try {
    res.render('change-password');
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};





const changePasswordValid = async (req, res) => {
  try {
    const { oldPassword } = req.body;
    const email = req.session.email; // Get email from session

    console.log('Session Data:', req.session); // Debugging: Log the entire session
    console.log('Session Email:', email); // Debugging: Log the email

    if (!email) {
      console.log('No email found in session. Redirecting to login.'); // Debugging
      return res.redirect('/login'); // Redirect if no email in session
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.render('change-password', {
        message: 'User not found.', 
      });
    }

    const isOldPasswordValid = await user.comparePassword(oldPassword);

    if (!isOldPasswordValid) {
      return res.render('change-password', {
        message: 'Old password is incorrect.', 
      });
    }

    // Generate OTP and send email
    const otp = generateOtp();
    req.session.userOtp = otp; // Save OTP in session

    console.log('Generated OTP:', otp); // Debugging

    const emailSent = await sendVerificationEmail(email, otp);

    console.log('Email Sent:', emailSent); // Debugging

    if (emailSent) {
      return res.render('change-password-otp', { message: '' }); // Render OTP page
    } else {
      return res.render('change-password', {
        message: 'Failed to send OTP. Please try again.',
      });
    }
  } catch (error) {
    console.error('Error in change password validation:', error);
    res.redirect('/pageNotFound');
  }
};






const verifyChangePassOtp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;
    if (enteredOtp === req.session.userOtp) {
      return res.json({
        success: true,
        redirectUrl: '/reset-password', // Ensure this matches your route
      });
    } else {
      return res.json({
        success: false,
        message: 'OTP not matching',
      });
    }
  } catch (error) {
    console.error('Error in verifyChangePassOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred, please try again later',
    });
  }
};

// Route to resend OTP for changing password
const resendChangePassOtp = async (req, res) => {
  try {
    const email = req.session.email;

    if (!email) {
      return res.json({
        success: false,
        message: 'Email not found. Please enter again.',
      });
    }

    const newOtp = generateOtp();
    const emailSent = await sendVerificationEmail(email, newOtp);

    if (emailSent) {
      req.session.userOtp = newOtp; // Update session with new OTP
      console.log('New OTP sent:', newOtp);

      return res.json({
        success: true,
        message: 'A new OTP has been sent to your email.',
      });
    } else {
      return res.json({
        success: false,
        message: 'Failed to send OTP. Please try again.',
      });
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.',
    });
  }
};

const addAddress = async (req, res) => {
  try {
    const user = req.session.user;
    res.render('add-address', { error: null, user }); // Pass null when no error
  } catch (error) {
    console.error('Error loading add address page:', error);
    res.redirect('/pageNotFound');
  }
};

const postAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const {
      name,
      addressLine1,
      city,
      state,
      postalCode,
      country,
      phoneNumber,
      isDefault,
    } = req.body;

    const newAddress = new Address({
      userId,
      name,
      addressLine1,
      addressLine2: req.body.addressLine2 || '',
      city,
      state,
      postalCode,
      country,
      phoneNumber,
      isDefault,
    });

    await newAddress.save();

    // Redirect to profile page with query param to stay on "My Address" tab
    res.redirect('/userProfile#address');
  } catch (error) {
    console.error('Error adding address:', error);
    res.render('add-address', { error: 'Something went wrong! Try again.' });
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const userId = req.session.user;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.redirect('/pageNotFound');
    }

    // Fetch user data from the database using the userId stored in session
    const user = await User.findById(userId); // Assuming you have a User model

    if (!user) {
      return res.redirect('/pageNotFound');
    }

    // Log the user to check if it's correct
    console.log('User data:', user);

    // Find the address by ID and userId
    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      return res.redirect('/pageNotFound');
    }

    res.render('edit-address', { address, user, error: null });
  } catch (error) {
    console.error('Error in getEditAddress:', error);
    res.redirect('/pageNotFound');
  }
};

const postEditAddress = async (req, res) => {
  try {
    const addressId = req.body.id;
    const userId = req.session.user; // Get userId from session
    const {
      name,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phoneNumber,
      isDefault,
    } = req.body;

    // Update the address
    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId }, // Use userId from session
      {
        $set: {
          name,
          addressLine1,
          addressLine2: addressLine2 || '',
          city,
          state,
          postalCode,
          country,
          phoneNumber,
          isDefault: isDefault === 'on',
        },
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.redirect('/pageNotFound');
    }

    // If this address is set as default, unset the default for other addresses
    if (isDefault === 'on') {
      await Address.updateMany(
        { userId, _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );
    }

    res.redirect('/userProfile');
  } catch (error) {
    console.error('Error in postEditAddress:', error);
    res.render('edit-address', {
      error: 'Something went wrong! Try again.',
      address: req.body,
      user: req.session.user,
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const userId = req.session.user; // Get userId from session

    // Validate address ID
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(404).send('Address not found');
    }

    // Find the address using both userId and addressId
    const findAddress = await Address.findOne({ _id: addressId, userId });

    if (!findAddress) {
      return res.status(404).send('Address not found');
    }

    // Remove the address from the user's addresses
    await Address.deleteOne({ _id: addressId, userId });

    // Redirect to the user profile page after deletion
    res.redirect('/userProfile');
  } catch (error) {
    console.error('Error in delete address:', error);
    res.redirect('/pageNotFound');
  }
};


const changeNamePage = (req, res) => {
  res.render('change-name', { 
    user: req.user,
    errors: [] // Initialize errors as empty array
  });
};
const updateName = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  const errors = [];

  // Validate name
  const namePattern =  /^[A-Za-z\s]{3,}$/;

  if (!name || !namePattern.test(name)) {
    errors.push('Please enter a valid name with at least 3 letters, no symbols, and no spaces.');
  }

  // If there are errors, return them as JSON
  if (errors.length > 0) {
    return res.json({ errors }); // Send back the errors as a JSON response
  }

  try {
    // Update name in the database
    const updatedUser = await User.findByIdAndUpdate(userId, { name }, { new: true });
    res.json({ success: true }); // Respond with a success message
  } catch (error) {
    console.error(error);
    res.status(500).json({ errors: ['Error updating name'] });
  }
};



// Controller to show the page for changing phone
const changePhonePage = (req, res) => {
  res.render('change-phone', { 
    user: req.user,
    errors: [] // Initialize errors as empty array
  });
};



const updatePhone = async (req, res) => {
  const { phone } = req.body;
  const userId = req.user.id;

  const errors = [];

  // Validate phone number (only digits, exactly 10 characters long)
  const phonePattern = /^[0-9]{10}$/;

  if (!phone || !phonePattern.test(phone)) {
    errors.push('Please enter a valid 10-digit phone number.');
  }

  // If there are errors, return them as JSON
  if (errors.length > 0) {
    return res.json({ errors }); // Send back the errors as a JSON response
  }

  try {
    // Update phone in the database
    const updatedUser = await User.findByIdAndUpdate(userId, { phone }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ errors: ['User not found'] });
    }

    res.json({ success: true }); // Respond with a success message
  } catch (error) {
    console.error(error);
    res.status(500).json({ errors: ['Error updating phone number'] });
  }
};





module.exports = {
  sendVerificationEmail,
  getForgotPassPage,
  forgotEmailValid,
  verifyForgotPassOtp,
  resendOtp,
  postNewPassword,
  getUpdatePage,
  userProfile,
  changeEmail,
  changeEmailValid,
  verifyEmailOtp,
  resendEmailOtp,
  changePassword,
  changePasswordValid,
  verifyChangePassOtp,
  resendChangePassOtp,
  getResetPassPage,
  addAddress,
  postAddAddress,
  editAddress,
  postEditAddress,
  deleteAddress,
  changeNamePage,
  changePhonePage,
  updateName,
  updatePhone
  
};

