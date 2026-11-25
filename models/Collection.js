
const mongoose = require("mongoose");

const CollectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  image: {
    type: String,
    default: "",
  },
  collectionType: {
    type: String,
    enum: ["MANUAL", "AUTOMATIC"],
    default: "MANUAL",
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  }],
  rules: [{
    field: String,
    operator: String,
    value: mongoose.Schema.Types.Mixed,
  }],
  displayOrder: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE"],
    default: "ACTIVE",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Collection", CollectionSchema);
