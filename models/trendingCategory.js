const mongoose = require('mongoose');

const TrendingCategorySchema = new mongoose.Schema({
    category: {
        type: String,
        default: ""
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    subCategory: {
        type: String,
        default: ""
    },
    subCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    media:{
         type: String 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("trendingcategory", TrendingCategorySchema);