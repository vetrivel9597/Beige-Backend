const mongoose = require('mongoose');

const socialMediaSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    facebook_link: {
        type: String,
    },
    twitter_link: {
        type: String,
    },
    whatsapp_link: {
        type: String,
    },
    instragram_link: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("socialMedia", socialMediaSchema);
