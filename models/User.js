const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String
    },
    lastname: {
        type: String,
        default : ""
    },
    mobile: {
        type: String,
    },
    dailCode : {
        type: String,
    },
    dob: {
        type: String,
        default : ""
    },
    gender: {
        type: String,
        default : ""
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    default_address:{
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
    lastloginIpAddress:{
        type:String,
        default:""
    },
});

module.exports = mongoose.model("User", UserSchema);
