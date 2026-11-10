const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    productname: {
        type: String,
        default: ""
    },
    description: {
        type: String
    },
    pagelink:{
        type:String,
        unique: true  
    },
    pagemetatitle:{
        type:String
    },
    pagemetadescription:{
        type:String
    },
    pagemetakeywords:{
        type:String
    },
    pageschema:{
        type:String
    },
    
    productimages: [{ media: { type: String } }],
    productStatus: {
        type:Number
    },
    price: {
        type: String,
        default: ""
    },
    gst_price: {
        type: String,
        default: ""
    },
    category: {
        type: String,
        default: ""
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'categories',
    },
    subCategory: {
        type: String,
        default: ""
    },
    subCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    size: {
        type: String,
    },
    shade: {
        type: String,
    },
    quantity: {
        type: Number,
        default: 0,
    },
    discount: {
        type: String,
        default: "0"
    },
    discount_price: {
        type: String,
    },
    final_price: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Product", ProductSchema);