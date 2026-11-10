const mongoose = require('mongoose');

const SiteSetting_Schema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    tax_Rate: {
        type: Number,
        required: true
    },
    ShippingCharge: {
        type: Number,
        required: true
    },
    tax_Type: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("sitesetting", SiteSetting_Schema);
