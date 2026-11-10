const mongoose = require('mongoose');

const SiteAddressSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
    },
    siteName: {
        type: String,
    },
    siteYear: {
        type: String,
    },
    email: {
        type: String,
    },
    mobile: {
        type: Number,
    },
    address:{
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("siteaddress", SiteAddressSchema);
