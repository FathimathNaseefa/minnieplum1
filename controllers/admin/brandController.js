const Brand = require('../../models/brandSchema');
const Product = require('../../models/productSchema');

const getBrandPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const brandData = await Brand.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands / limit);

    res.render('brand', {
      data: brandData,
      currentPag:page,
      currentPage: 'brand',
      totalPages: totalPages,
      totalBrands: totalBrands,
      messages: {
        success: req.flash('success'),
        error: req.flash('error'),
      },
    });
  } catch (error) {
    console.error('Error fetching brand page:', error);
    res.redirect('/pageerror');
  }
};

const addBrand = async (req, res) => {
  try {
    let { name } = req.body;
    name = name.trim(); // Remove leading/trailing spaces

    // Validation checks
    if (!name) {
      req.flash('error', 'Brand name cannot be blank.');
      return res.redirect('/admin/brand');
    }

    const validBrandRegex = /^[A-Za-z0-9\s]+$/;
    if (!validBrandRegex.test(name)) {
      req.flash('error', 'Brand name cannot contain only symbols.');
      return res.redirect('/admin/brand');
    }

    // Check for duplicate brand name (case insensitive)
    const findBrand = await Brand.findOne({
      brandName: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (findBrand) {
      req.flash('error', 'Brand name already exists.');
      return res.redirect('/admin/brand');
    }

    // Save new brand
    const newBrand = new Brand({
      brandName: name,
      isBlocked: false,
    });

    await newBrand.save();
    req.flash('success', 'Brand added successfully.');
    res.redirect('/admin/brand');
  } catch (error) {
    console.error('Error adding brand:', error);
    req.flash('error', 'Something went wrong.');
    res.redirect('/admin/brand');
  }
};


const blockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    const page = req.query.page || 1;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect(`/admin/brand?page=${page}`);
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const unBlockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    const page = req.query.page || 1;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect(`/admin/brand?page=${page}`);
  } catch (error) {
    res.redirect('/pageerror');
  }
};




const deleteBrand = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).redirect('/pageerror');
    }
    await Brand.deleteOne({ _id: id });
    res.redirect('/admin/brand');
  } catch (error) {
    console.error('Errordeleting brand:', error);
    res.status(500).redirect('/pageerror');
  }
};

module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unBlockBrand,
  deleteBrand,
};
