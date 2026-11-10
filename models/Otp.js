const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
    email: {
        type: String
    },
    mobile: {
        type: String,
        // default: "+91",
    },
    otp: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("OTP", OtpSchema);
