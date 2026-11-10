const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
    categoryName: {
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

module.exports = mongoose.model("Banner", BannerSchema);
