const mongoose = require('mongoose');

const OffercontentSchema = new mongoose.Schema({
    categoryName: {
        type: String,
    },
    categoryDescription: {
        type: String,
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'categories',
    },
    categoryImage: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Offercontent", OffercontentSchema);
