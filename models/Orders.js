const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
  userid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: {
    type: String,
    required: true
  },
  invoiceId: {
    type: String,
    required: true
  },
  product: [{
    productid: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    category:String,
    productname: String,
    productimages: [Object],
    productdetails: [{
      price: Number,
      gstPrice : Number,
      size: String,
      shade: String,
      quantity: Number,
      discount_price: Number
    }],
  }],
  delivery_Address: {
    name: { type: String },
    mobile: { type: Number },
    email: { type: String },
    address: { type: String },
  },
  productStatus: {
    type: String
  },
  shippingCharge:{
    type: Number
  },
  gstPercentage:{
    type: Number
  },
  totalDiscount:{
    type: Number
  },
  amount: {
    type: Number
  },
  barcode :{
		type: String
	},
  couponDiscount :{
		type: Number,
	},
  couponDiscountAmount :{
		type: Number,
	},
  promoCode :{
		type: String,
	},
  orderdate: {
    type: Date,
    default: Date.now
  },
  deliveryDate: {
    type: Date
  },
  deliveryStatus: {
    type: String
  },
});

module.exports = mongoose.model('Order', OrderSchema);
