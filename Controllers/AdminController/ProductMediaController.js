const mongoose = require("mongoose");
const multer = require("multer");

const ProductModel = require("../../models/Product");
const ProductMediaModel = require("../../models/ProductMedia");
const cloudinary = require("../../config/cloudinary");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  },
});

const uploadProductImages = upload.array("images", 10);

const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "products/media",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          altText: file.originalname,
        });
      }
    );

    stream.end(file.buffer);
  });
};

const deleteCloudinaryImages = async (images) => {
  await Promise.allSettled(
    images.map((image) =>
      cloudinary.uploader.destroy(image.publicId)
    )
  );
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const validateVideoUrl = (video) => {
  if (!video) return true;

  try {
    const url = new URL(video);

    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};


exports.createProductMedia = async (req, res) => {
  let uploadedImages = [];

  try {
    const { productId, video = "", mainImage } = req.body;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Valid product ID is required",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Please upload at least one product image",
      });
    }

    if (req.files.length > 10) {
      return res.status(400).json({
        status: false,
        message: "Maximum 10 images are allowed",
      });
    }

    if (
      mainImage === undefined ||
      !Number.isInteger(Number(mainImage)) ||
      !Number.isSafeInteger(Number(mainImage)) ||
      Number(mainImage) < 0 ||
      Number(mainImage) >= req.files.length
    ) {
      return res.status(400).json({
        status: false,
        message: "Please select a valid main image",
      });
    }

    if (!validateVideoUrl(video)) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid video URL",
      });
    }

    const product = await ProductModel.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const existingMedia = await ProductMediaModel.findOne({
      productId,
    });

    if (existingMedia) {
      return res.status(409).json({
        status: false,
        message: "Product media already exists",
      });
    }

    uploadedImages = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file))
    );

    const selectedMainImage = uploadedImages[Number(mainImage)];

    const productMedia = await ProductMediaModel.create({
      productId,
      images: uploadedImages,
      mainImage: selectedMainImage.url,
      video: video.trim(),
    });

    return res.status(201).json({
      status: true,
      message: "Product media created successfully",
      data: productMedia,
    });
  } catch (error) {
    console.error("CREATE PRODUCT MEDIA ERROR:", error);

    await deleteCloudinaryImages(uploadedImages);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Product media already exists",
      });
    }

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to create product media",
    });
  }
};


exports.getProductMedia = async (req, res) => {
  try {
    const productId = req.params.productId || req.query.productId;

    if (!productId) {
      return res.status(400).json({
        status: false,
        message: "Product ID is required"
      });
    }

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID"
      });
    }

    const productMedia = await ProductMediaModel.findOne({
      productId
    }).populate("productId", "name productname sku");

    if (!productMedia) {
      return res.status(404).json({
        status: false,
        message: "Product media not found"
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product media fetched successfully",
      data: {
        _id: productMedia._id,
        productId: productMedia.productId?._id || productMedia.productId,
        images: productMedia.images,
        mainImage: productMedia.mainImage,
        video: productMedia.video,
        createdAt: productMedia.createdAt,
        updatedAt: productMedia.updatedAt
      }
    });

  } catch (error) {
    console.error("GET PRODUCT MEDIA ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to fetch product media"
    });
  }
};


exports.updateProductMedia = async (req, res) => {
  let uploadedImages = [];

  try {
    const { productId } = req.params;
    const { video = "", mainImage } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    if (!validateVideoUrl(video)) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid video URL",
      });
    }

    const productMedia = await ProductMediaModel.findOne({
      productId,
    });

    if (!productMedia) {
      return res.status(404).json({
        status: false,
        message: "Product media not found",
      });
    }

    const newFiles = req.files || [];

    const combinedImages = [
      ...productMedia.images,
      ...newFiles,
    ];

    if (combinedImages.length === 0) {
      return res.status(400).json({
        status: false,
        message: "At least one product image is required",
      });
    }

    if (combinedImages.length > 10) {
      return res.status(400).json({
        status: false,
        message: "Maximum 10 images are allowed",
      });
    }

    const selectedMainIndex = Number(mainImage);

    if (
      mainImage === undefined ||
      mainImage === "" ||
      !Number.isSafeInteger(selectedMainIndex) ||
      selectedMainIndex < 0 ||
      selectedMainIndex >= combinedImages.length
    ) {
      return res.status(400).json({
        status: false,
        message: "Please select a valid main image",
      });
    }

    uploadedImages = await Promise.all(
      newFiles.map((file) => uploadToCloudinary(file))
    );

    const finalImages = [
      ...productMedia.images,
      ...uploadedImages,
    ];

    productMedia.images = finalImages;
    productMedia.mainImage =
      finalImages[selectedMainIndex].url;
    productMedia.video = video.trim();

    await productMedia.save();

    return res.status(200).json({
      status: true,
      message: "Product media updated successfully",
      data: productMedia,
    });
  } catch (error) {
    console.error("UPDATE PRODUCT MEDIA ERROR:", error);

    await deleteCloudinaryImages(uploadedImages);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to update product media",
    });
  }
};

exports.uploadProductImages = uploadProductImages;
