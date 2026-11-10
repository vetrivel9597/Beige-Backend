require('../config/environment');
const Cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
Cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const CloudStorage = new CloudinaryStorage({
    cloudinary: Cloudinary,
    params: {
        folder: "skincare",
        resource_type: 'auto',
    }
})
exports.uploads = multer({
    storage: CloudStorage
})
