const User = require('../../models/userSchema');
const ReferralOffer = require('../../models/referralOfferSchema');

// Generate Unique Referral Code
const generateReferralCode = (name) => {
  return (
    name.substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000)
  );
};

// Apply Referral Offer During Signup
exports.applyReferral = async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    // Check if referral code is valid
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
      if (!referrer) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }
    }

    // Generate new user with a unique referral code
    const newUser = new User({
      name,
      email,
      password, // Hash password in production
      referralCode: generateReferralCode(name),
      referredBy: referralCode || null,
    });
    await newUser.save();

    // Check if referral rewards are active
    const activeReferralOffer = await ReferralOffer.findOne({ isActive: true });
    if (activeReferralOffer && referrer) {
      // Credit rewards to both referrer and new user
      referrer.wallet += activeReferralOffer.rewardAmount;
      newUser.wallet += activeReferralOffer.rewardAmount;
      await referrer.save();
      await newUser.save();
    }

    res
      .status(201)
      .json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error('Error applying referral:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get Referral Offer Details
exports.getReferralOffer = async (req, res) => {
  try {
    const offer = await ReferralOffer.findOne({ isActive: true });
    if (!offer)
      return res
        .status(404)
        .json({ message: 'No active referral offer found' });
    res.status(200).json(offer);
  } catch (error) {
    console.error('Error fetching referral offer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Create Referral Offer (Admin)
exports.createReferralOffer = async (req, res) => {
  try {
    const { rewardAmount, expiry } = req.body;
    const offer = new ReferralOffer({ rewardAmount, expiry });
    await offer.save();
    res.status(201).json({ message: 'Referral offer created', offer });
  } catch (error) {
    console.error('Error creating referral offer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Deactivate Referral Offer (Admin)
exports.deactivateReferralOffer = async (req, res) => {
  try {
    await ReferralOffer.updateMany({}, { isActive: false });
    res.status(200).json({ message: 'Referral offer deactivated' });
  } catch (error) {
    console.error('Error deactivating referral offer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
