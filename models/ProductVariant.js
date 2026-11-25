const mongoose = require("mongoose");

const ProductVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantType: {
      type: String,
      enum: ["SIZE", "VOLUME", "SHADE"],
      required: true,
      uppercase: true,
      trim: true,
    },
    variantName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    barcode: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

ProductVariantSchema.index(
  { productId: 1, sku: 1 },
  { unique: true }
);

module.exports = mongoose.model("ProductVariant", ProductVariantSchema);