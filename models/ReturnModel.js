const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ReturnItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String, required: true },
    variantId: { type: Schema.Types.ObjectId, default: null },
    size: { type: String, default: "" },
    shade: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    returnAmount: { type: Number, required: true, min: 0 },
    isOpened: { type: Boolean, default: false },
    condition: {
      type: String,
      enum: ["NOT_CHECKED", "SEALED", "UNOPENED", "OPENED", "DAMAGED", "DEFECTIVE"],
      default: "NOT_CHECKED",
    },
    restocked: { type: Boolean, default: false },
    restockedQuantity: { type: Number, default: 0 },
  },
  { _id: true }
);

const ReturnSchema = new Schema(
  {
    returnId: { type: String, unique: true, index: true },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    orderNumber: { type: String, default: "" },

    userid: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: {
      type: [ReturnItemSchema],
      required: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    description: { type: String, default: "" },

    customerPhotos: [{ type: String }],

    eligibility: {
      eligible: { type: Boolean, default: false },
      reason: { type: String, default: "" },
      checkedAt: { type: Date, default: Date.now },
    },

    status: {
      type: String,
      enum: [
        "REQUESTED",
        "APPROVED",
        "REJECTED",
        "PICKUP_SCHEDULED",
        "RECEIVED",
        "REFUNDED",
      ],
      default: "REQUESTED",
      index: true,
    },

    rejectionReason: { type: String, default: "" },

    pickup: {
      pickupDate: { type: Date, default: null },
      courierName: { type: String, default: "" },
      trackingNumber: { type: String, default: "" },
      trackingUrl: { type: String, default: "" },
      notes: { type: String, default: "" },
    },

    received: {
      receivedAt: { type: Date, default: null },
      condition: {
        type: String,
        enum: ["SEALED", "UNOPENED", "OPENED", "DAMAGED", "DEFECTIVE"],
        default: null,
      },
      conditionNotes: { type: String, default: "" },
      restock: { type: Boolean, default: false },
      warehouseId: {
        type: Schema.Types.ObjectId,
        ref: "Warehouse",
        default: null,
      },
    },

    refund: {
      refundType: {
        type: String,
        enum: ["FULL", "PARTIAL"],
        default: "FULL",
      },
      amount: { type: Number, default: 0 },
      refundMethod: {
        type: String,
        enum: ["GATEWAY", "STORE_CREDIT"],
        default: "GATEWAY",
      },
      reason: { type: String, default: "" },
      gatewayRefundId: { type: String, default: "" },
      status: {
        type: String,
        enum: ["NOT_INITIATED", "PROCESSING", "SUCCESS", "FAILED"],
        default: "NOT_INITIATED",
      },
      processedAt: { type: Date, default: null },
    },

    timeline: [
      {
        status: { type: String, required: true },
        message: { type: String, default: "" },
        changedBy: {
          type: Schema.Types.ObjectId,
          ref: "Admin",
          default: null,
        },
        changedAt: { type: Date, default: Date.now },
      },
    ],

    internalNotes: [
      {
        note: { type: String, required: true },
        addedBy: {
          type: Schema.Types.ObjectId,
          ref: "Admin",
          default: null,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

ReturnSchema.index({ createdAt: -1 });
ReturnSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Return", ReturnSchema);