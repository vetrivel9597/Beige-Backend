const mongoose = require('mongoose');

const FAQSchema = new mongoose.Schema({
    faqTitle: {
        type: String,
    },
    faqDescription: {
        type: String,
    },
    status: {
        type: Number,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("FAQ", FAQSchema);
