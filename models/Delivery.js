
const mongoose = require('mongoose');

const DeliveryHistorySchema = new mongoose.Schema({

    deliveryStatus: {
        type: String,
        enum: [
            "Ordered",
            "Confirmed",
            "Processing",
            "Shipped",
            "Out for Delivery",
            "Delivered",
            "Cancelled"
        ],
        required: true
    },

    message: {
        type: String,
        default: ""
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }

}, { _id: true });


const DeliverySchema = new mongoose.Schema({

    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    userid: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },

    deliveryStatus: {
        type: String,
        enum: [
            "Ordered",
            "Confirmed",
            "Processing",
            "Shipped",
            "Out for Delivery",
            "Delivered",
            "Cancelled"
        ],
        default: "Ordered"
    },

    trackingNumber: {
        type: String,
        default: null
    },

    courierName: {
        type: String,
        default: null
    },

    shippedDate: {
        type: Date,
        default: null
    },

    estimatedDeliveryDate: {
        type: Date,
        default: null
    },

    deliveryDate: {
        type: Date,
        default: null
    },

    deliveryProof: {
        type: String,
        default: null
    },

    deliveryRemarks: {
        type: String,
        default: ""
    },

    statusHistory: {
        type: [DeliveryHistorySchema],
        default: []
    }

}, {
    timestamps: true
});


module.exports = mongoose.model("Delivery", DeliverySchema);

