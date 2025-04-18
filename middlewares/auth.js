const User = require('../models/userSchema');

const userAuth = async (req, res, next) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user);

            if (user) {
                if (!user.isBlocked) {
                    req.user = user;
                    return next();
                } else {
                    console.log(`User ${user.email} is blocked. Destroying session...`);

                    req.session.destroy((err) => {
                        if (err) {
                            console.error('Error destroying session:', err);
                            return res.status(500).send('Internal Server Error');
                        }
                        res.clearCookie('connect.sid'); // Ensure the session cookie is removed
                        return res.redirect('/login'); // Ensure only one response is sent
                    });

                    return; // Prevent further execution
                }
            } else {
                return res.redirect('/login'); // Ensure only one response is sent
            }
        } catch (error) {
            console.error('Error in user auth middleware:', error);
            return res.status(500).send('Internal Server Error');
        }
    } else {
        return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
};








const adminAuth = (req, res, next) => {
  User.findOne({ isAdmin: true })
    .then((data) => {
      if (data) {
        next();
      } else {
        res.redirect('/admin/login');
      }
    })
    .catch((error) => {
      console.log('Error in admin auth middleware');
      res.status(500).send('Internal Server Error');
    });
};

module.exports = {
  userAuth,
  adminAuth,
};
