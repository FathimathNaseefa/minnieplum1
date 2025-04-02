const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);
    res.render('category', {
      cat: categoryData,
      currentPag: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
      currentPage: 'category',
    });
  } catch (error) {
    console.error(error);
    res.redirect('/pageerror');
  }
};

const addCategory = async (req, res) => {
  let { name, description } = req.body;

  // Trim and normalize input
  name = name.trim().toLowerCase();
  description = description.trim();

  // Validation checks
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  if (!/^[a-zA-Z\s]+$/.test(name)) {
    return res
      .status(400)
      .json({ error: 'Category name should contain only alphabets' });
  }
  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    // Case-insensitive check for existing category
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (existingCategory) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    // Create and save new category
    const newCategory = new Category({ name, description });
    await newCategory.save();

    return res.json({ message: 'Category added successfully' });
  } catch (error) {
    console.error('Error adding category:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: 'Category not found' });
    }
    const products = await Product.find({ category: category._id });
    const hasProductOffer = products.some(
      (product) => product.productOffer > percentage
    );
    if (hasProductOffer) {
      return res.json({
        status: false,
        message: 'products within this category already have product offer',
      });
    }
    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: percentage } }
    );

    for (const product of products) {
      product.productOffer = 0;
      product.salePrice = product.regularPrice;
      await product.save();
    }
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: 'Category not found' });
    }
    const percentage = category.categoryOffer;
    const products = await Product.find({ category: category._id });

    if (products.length > 0) {
      for (const product of products) {
        product.productOffer = 0;
        product.salePrice += Math.floor(
          product.regularPrice * (percentage / 100)
        );
        await product.save();
      }
    }
    category.categoryOffer = 0;
    await category.save();
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
};

const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect('/admin/category');
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const getUnlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect('/admin/category');
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const getEditCategory = async (req, res) => {
  try {
    let id = req.query.id;
    const category = await Category.findOne({ _id: id });
    res.render('edit-category', { category: category ,currentPage:'category'});
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await category.deleteOne();
    res.redirect('/admin/category');
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


const editCategory = async (req, res) => {
  try {
      const id = req.params.id;
      let { categoryName, description } = req.body;
      
      // Validate input exists
      if (!categoryName || !description) {
          return res.status(400).json({ 
              error: 'All fields are required' 
          });
      }

      categoryName = categoryName.trim();
      description = description.trim();

      // Validate category name format
      if (!/^[a-zA-Z\s]+$/.test(categoryName)) {
          return res.status(400).json({ 
              nameError: 'Category name should contain only alphabets' 
          });
      }

      // Check for existing category (excluding current category)
      const existingCategory = await Category.findOne({ 
          name: categoryName,
          _id: { $ne: id }
      });

      if (existingCategory) {
          return res.status(400).json({ 
              nameError: 'Category already exists, please choose another name' 
          });
      }

      const updateCategory = await Category.findByIdAndUpdate(
          id,
          {
              name: categoryName,
              description: description,
              updatedAt: Date.now()
          },
          { new: true, runValidators: true }
      );

      if (!updateCategory) {
          return res.status(404).json({ 
              error: 'Category not found' 
          });
      }

      return res.json({ 
          success: true,
          message: 'Category updated successfully'
      });

  } catch (error) {
      console.error('Server error:', error);
      
      // Handle specific Mongoose validation errors
      if (error.name === 'ValidationError') {
          const errors = {};
          Object.keys(error.errors).forEach(key => {
              errors[key] = error.errors[key].message;
          });
          return res.status(400).json(errors);
      }

      return res.status(500).json({ 
          error: 'An unexpected error occurred. Please try again later.' 
      });
  }
};



module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
  deleteCategory,
};
