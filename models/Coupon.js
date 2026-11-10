const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    coupons: [
        {
            code: { type: String},
            discount: { type: String }
        }
    ]
});

module.exports = mongoose.model("Coupon", CouponSchema);
