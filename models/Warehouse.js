
const mongoose = require("mongoose");

const WarehouseSchema = new mongoose.Schema({
  warehouseName: {
    type: String,
    required: true,
    trim: true,
  },
  warehouseCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  contactPerson: {
    type: String,
    default: "",
  },
  phone: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    default: "",
  },
  address: {
    type: String,
    default: "",
  },
  city: {
    type: String,
    default: "",
  },
  state: {
    type: String,
    default: "",
  },
  pincode: {
    type: String,
    default: "",
  },
  isDefault: {
    type: Boolean,
    default: false,
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

module.exports = mongoose.model("Warehouse", WarehouseSchema);
