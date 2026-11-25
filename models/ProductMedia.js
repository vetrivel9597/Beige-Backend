
const mongoose = require("mongoose");

const ProductMediaSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
        altText: {
          type: String,
          default: "",
        },
      },
    ],
    mainImage: {
      type: String,
      required: true,
    },
    video: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ProductMedia",
  ProductMediaSchema
);
