const getDiscountedPrice = (product) => {
  let price = product.price;

  // Check if Product Offer is available
  if (product.offer && product.offer.discountType === 'percentage') {
    price -= (price * product.offer.discountValue) / 100;
  } else if (product.offer && product.offer.discountType === 'fixed') {
    price -= product.offer.discountValue;
  }

  // Check if Category Offer is available (if it's higher than Product Offer)
  if (product.category.offer) {
    let categoryDiscount =
      product.category.offer.discountType === 'percentage'
        ? (product.price * product.category.offer.discountValue) / 100
        : product.category.offer.discountValue;

    if (categoryDiscount > (product.offer?.discountValue || 0)) {
      price = product.price - categoryDiscount;
    }
  }

  return Math.max(price, 0); // Ensure price never goes below 0
};

module.exports = {
  getDiscountedPrice,
};
