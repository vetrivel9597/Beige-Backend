const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    firstName: {
        type: String
    },
    lastName: {
        type: String,
    },
    phoneNumber: {
        type: Number,
    },
    dob: {
        type: String,
    },
    gender: {
        type: String,
    },
    other_address:[{
        firstname: { type: String, default: "" },
        lastname: { type: String, default: "" },
        address: { type: String, default: "" },
        mobilenumber: { type: String, default: "" },
        addressType: { type: String, default: "" },
        date: {type: Date,default: Date.now}
    }],
});

module.exports = mongoose.model("Profile", profileSchema);
