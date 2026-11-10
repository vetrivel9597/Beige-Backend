const mongoose = require('mongoose');

const influencerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        lowercase: true
    },
    contact: {
        whatsapp: {
            type: String
        },
        instagram: {
            type: String
        },
        twitter: {
            type: String
        },
        facebook: {
            type: String
        },
        telegram: {
            type: String
        }
    },
    youtubelink: {
        type: String
    },
    instagramid: {
        type: String
    },
    facebookid: {
        type: String
    },
    telegramid: {
        type: String
    },
    youtubesubscribers: {
        type: Number,
        default: 0
    },
    instafollowers: {
        type: Number,
        default: 0
    },
    facebookfollowers: {
        type: String,
        default: 0
    },
    telegramsubscribers: {
        type: Number,
        default: 0
    },
    promoCode: {
        type: String,
        default: ""
    },
    influencerStatus: {
        type: String,
        default: ""
    },
    CouponDiscount: {
        type: Number,
        default: 0
    },
    couponStatus: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model("Influencer", influencerSchema);
