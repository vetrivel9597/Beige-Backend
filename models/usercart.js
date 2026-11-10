const mongoose = require('mongoose');
const Coupon = require('./Coupon');

const UsercartSchema = new mongoose.Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    product: [
        {
            productid: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
            },
            quantity: {
                type: String,
                default: "1"
            },
        }
    ],
    promoCode: {
        type: String,
        default: ""

    },
    CouponDiscount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// const Usercart = mongoose.model("Usercart", UsercartSchema);
module.exports = mongoose.model("Usercart", UsercartSchema);
