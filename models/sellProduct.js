const mongoose = require('mongoose');

const sell_ProductSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
    },
    productname: {
        type: String,
        default: ""
    },
    quantity: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("sellProduct", sell_ProductSchema);