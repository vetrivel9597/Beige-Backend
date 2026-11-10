const mongoose = require('mongoose');

const categoriesSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    subCategories: [
        {
            name: {
                type: String,
                required: true
            },
            image: {
                type: String
            },
            status: {
                type: Number,
                default: 1 
            }
        }
    ],
    status: {
        type: Number,
        default: 1
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("categories", categoriesSchema);
