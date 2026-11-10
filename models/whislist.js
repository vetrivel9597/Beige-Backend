const mongoose = require('mongoose');

const whislistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
    },
    status: {
        type: Number,
        default : 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("whislist", whislistSchema);
