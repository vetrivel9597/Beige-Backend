const mongoose = require('mongoose')
const adminSchema = new mongoose.Schema({
    email: {
        type: String
    },
    password: {
        type: String
    },
    role: {
        type: String,
        enum: ['super_admin', 'catalog_manager', 'order_manager', 'support'],
        default: 'super_admin',
        index: true,
    },
    lastLoginIP: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model("admin", adminSchema);
