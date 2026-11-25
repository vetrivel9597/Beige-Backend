const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    batchNumber: {
      type: String,
      trim: true,
      required: true,
    },
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    onHand: {
      type: Number,
      default: 0,
      min: 0,
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },
    available: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    manufacturingDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"],
      default: "IN_STOCK",
    },
  },
  {
    timestamps: true,
  }
);

InventorySchema.index(
  { productId: 1, variantId: 1, warehouseId: 1, batchNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("Inventory", InventorySchema);