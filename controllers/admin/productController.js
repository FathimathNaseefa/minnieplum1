const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const User = require('../../models/userSchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render('product-add', {
      cat: category,
      brand: brand,
      currentPage: 'addProducts',
    });
  } catch (error) {
    res.redirect('/pageerror');
  }
};





const addProducts = async (req, res) => {
  try {
    const products = req.body;       
    const productExists = await Product.findOne({
      productName: products.productName,
    });

    if (!productExists) {
      const images = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path;
          const resizedImagePath = path.join(
            'public',
            'uploads',
            'product-images',        
            req.files[i].filename    
          );

          await sharp(originalImagePath)
            .resize({ width: 440, height: 440 })
            .toFile(resizedImagePath);
          images.push(req.files[i].filename);
        }
      }

      // ✅ Convert category name to ObjectId
      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.status(400).json('Invalid category name');
      }

      // ✅ Convert brand name to ObjectId
      const brandId = await Brand.findOne({ brandName: new RegExp('^' + products.brand + '$', 'i') });
console.log("Found brand:", brandId); // Debugging

if (!brandId) {
  return res.status(400).json('Invalid brand name');
}


      const status = products.quantity <= 0 ? 'Soldout' : 'Available';    

      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        brand: brandId._id, // ✅ Store ObjectId
        category: categoryId._id, // ✅ Store ObjectId
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        createdOn: new Date(),       
        quantity: products.quantity, 
        stock: products.quantity,    
        size: Array.isArray(products.size) ? products.size : [products.size],
        color: Array.isArray(products.color) ? products.color : [products.color],
        productImage: images,        
        status: status,
        maxPerPerson: products.maxPerPerson || 5,
        highlights: products.highlights ? products.highlights.split(',') : [],
        specifications: products.specifications ? JSON.parse(products.specifications) : {},
      });

      await newProduct.save();       
      res.redirect('/admin/products');
    } else {
      return res
        .status(400)
        .json('Product already exists, please try with another name');    
    }
  } catch (error) {
    console.error('Error saving product', error);
    return res.redirect('/admin/pageerror');
  }
};





const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    // Search condition for product name
    const searchConditions = [
      { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } },
    ];

    // Check if searching for brand name
    let brandId = null;
    if (search.trim() !== '') {
      const brandSearch = await Brand.findOne({
        name: { $regex: new RegExp(search, 'i') },
      });
      if (brandSearch) {
        brandId = brandSearch._id;
        searchConditions.push({ brand: brandId }); // Add brand filter only if found
      }
    }

    // Fetch products with applied filters
    const productData = await Product.find({
      $or: searchConditions,
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('category')
      .populate('brand') // Populate brand details
      .exec();

    // Count total matching products
    const count = await Product.countDocuments({
      $or: searchConditions,
    });

    // Fetch category and brand data
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category && brand) {
      res.render('products', {
        data: productData,
        currentPag: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        brand: brand,
        currentPage: 'products',
      });
    } else {
      res.render('page-404');
    }
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.redirect('/pageerror');
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    const findCategory = await Category.findOne({ _id: findProduct.category });
    if (findCategory.categoryOffer > percentage) {
      return res.json({
        status: false,
        message: 'This products category already has a category offer',
      });
    }
    findProduct.salePrice =
      findProduct.salePrice -
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = parseInt(percentage);
    await findProduct.save();
    findCategory.categoryOffer = 0;
    await findCategory.save();
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    const percentage = findProduct.productOffer;
    findProduct.salePrice =
      findProduct.salePrice +
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = 0;
    await findProduct.save();
    res.json({ status: true });
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect('/admin/products');
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect('/admin/products');
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({});
    const brand = await Brand.find({});

    res.render('edit-product', {
      product: product,
      cat: category,
      brand: brand,
      currentPage: 'products',
    });
  } catch (error) {
    res.redirect('/pageerror');
  }
};


const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    const data = req.body;

    // ✅ Check if the product name already exists (excluding the current one)
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });
    if (existingProduct) {
      return res.status(400).json({
        error: 'Product with this name already exists. Please try another name.',
      });
    }

    // ✅ Convert Brand Name to ObjectId
    const brandData = await Brand.findOne({ brandName: new RegExp('^' + data.brand + '$', 'i') });
    if (!brandData) {
      return res.status(400).json({ error: 'Invalid brand name' });
    }

    // ✅ Prepare Image Updates
    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        images.push(req.files[i].filename);
      }
    }

    // ✅ Prepare Update Fields
    const updateFields = {
      productName: data.productName,
      description: data.description,
      brand: brandData._id,  // ✅ Save as ObjectId
      category: product.category,
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      quantity: data.quantity,
      size: Array.isArray(data.size) ? data.size : [data.size],
      color: Array.isArray(data.color) ? data.color : [data.color],
    };

    // ✅ Append new images if uploaded
    if (req.files.length > 0) {
      updateFields.$push = { productImage: { $each: images } };
    }

    await Product.findByIdAndUpdate(id, updateFields, { new: true });
    res.redirect('/admin/products');
  } catch (error) {
    console.error(error);
    res.redirect('/pageerror');
  }
};


const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });
    const imagePath = path.join(
      'public',
      'uploads',
      're-image',
      imageNameToServer
    );
    if (fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }
    res.send({ status: true });
  } catch (error) {
    res.redirect('/pageerror');
  }
};
const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findByIdAndDelete(productId);
    if (!product) {
      return res
        .status(404)
        .json({ status: false, message: 'Product not found' });
    }
    return res
      .status(200)
      .json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    return res
      .status(500)
      .json({ status: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  getEditProduct,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  editProduct,
  deleteSingleImage,
  deleteProduct,
};
