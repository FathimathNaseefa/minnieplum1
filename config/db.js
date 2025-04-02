const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/nodewebapp');
    console.log('DB connected');
  } catch (error) {
    console.log('DB connection error', error.message);
    process.exit(1);
  }
};


module.exports = connectDB;


