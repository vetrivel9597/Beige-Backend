const mongoose = require('mongoose');

const  categorypagebannerSchema = new mongoose.Schema({
    categorypagebannerName: {
        type: String,
    },
    categorypagebannerTitle: {
        type: String,
    },
    categorypagebannerDescription: {
        type: String,
    },
    categorypagebannerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'categories',
    },
    categorypagebannerImage: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model(" categorypagebanner",  categorypagebannerSchema);
