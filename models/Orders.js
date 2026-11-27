
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DeliveryAddressSchema = new Schema(
  {
    name: { type: String, default: "" },
    mobile: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    addressLine2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    pincode: { type: String, default: "" },
  },
  { _id: false }
);

const OrderProductSchema = new Schema(
  {
    productid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },

    category: { type: String, default: "" },
    productname: { type: String, default: "" },
    productimages: { type: [Schema.Types.Mixed], default: [] },
    sku: { type: String, default: "" },

    productdetails: [
      {
        price: { type: Number, default: 0 },
        gstPrice: { type: Number, default: 0 },

        size: { type: String, default: "" },
        shade: { type: String, default: "" },

        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },

        discount_price: { type: Number, default: 0 },

        gstPercentage: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },

        total: { type: Number, default: 0 },
      },
    ],
  },
  { _id: true }
);

const OrderStatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: true,
    },

    comment: {
      type: String,
      default: "",
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const OrderNoteSchema = new Schema(
  {
    note: {
      type: String,
      required: true,
      trim: true,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ShipmentSchema = new Schema(
  {
    courierName: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    shipmentId: { type: String, default: "" },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { _id: false }
);



const OrderSchema = new Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    orderId: {
      type: String,
      required: true,
      trim: true,
    },

    invoiceId: {
      type: String,
      required: true,
      trim: true,
    },

    product: {
      type: [OrderProductSchema],
      default: [],
    },

    delivery_Address: {
      type: DeliveryAddressSchema,
      default: () => ({}),
    },

    orderStatus: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "PACKED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PENDING",
      index: true,
    },

    productStatus: {
      type: String,
      default: "",
    },

    deliveryStatus: {
      type: String,
      default: "",
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },

    paymentMethod: {
      type: String,
      default: "",
    },

    subtotal: {
      type: Number,
      default: 0,
    },

    shippingCharge: {
      type: Number,
      default: 0,
    },

    gstPercentage: {
      type: Number,
      default: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    totalDiscount: {
      type: Number,
      default: 0,
    },

    amount: {
      type: Number,
      default: 0,
    },

    couponDiscount: {
      type: Number,
      default: 0,
    },

    couponDiscountAmount: {
      type: Number,
      default: 0,
    },

    promoCode: {
      type: String,
      default: "",
    },

    paymentDetailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentDetail",
      default: null,
    },

    shipment: {
      type: ShipmentSchema,
      default: () => ({}),
    },

    courierName: {
      type: String,
      default: "",
    },

    trackingNumber: {
      type: String,
      default: "",
    },

    trackingUrl: {
      type: String,
      default: "",
    },

    shippedAt: Date,
    deliveredAt: Date,

    cancelReason: {
      type: String,
      default: "",
    },

    cancelledAt: Date,

    refundAmount: {
      type: Number,
      default: 0,
    },

    refundDate: Date,

    barcode: {
      type: String,
      default: "",
    },

    invoice: {
      type: String,
      default: "",
    },

    packingSlip: {
      type: String,
      default: "",
    },

    internalNotes: {
      type: [OrderNoteSchema],
      default: [],
    },

    statusHistory: {
      type: [OrderStatusHistorySchema],
      default: [],
    },

    source: {
      type: String,
      enum: ["WEBSITE", "ADMIN", "OTHER"],
      default: "WEBSITE",
    },

    orderdate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    deliveryDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);



OrderSchema.index({ orderId: 1 }, { unique: true });
OrderSchema.index({ invoiceId: 1 }, { unique: true });
OrderSchema.index({ userid: 1, orderdate: -1 });
OrderSchema.index({ orderStatus: 1, orderdate: -1 });
OrderSchema.index({ paymentStatus: 1, orderdate: -1 });

module.exports = mongoose.model("Order", OrderSchema);
