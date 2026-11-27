
const mongoose = require("mongoose");

const PaymentDetailsSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		orderId: {
			type: String,
			required: true,
			index: true,
		},

		invoiceId: {
			type: String,
			default: "",
		},

		paymentId: {
			type: String,
			default: "",
		},

		signature: {
			type: String,
			default: "",
		},

		amount: {
			type: Number,
			default: 0,
		},

		currency: {
			type: String,
			default: "INR",
		},

		barcode: {
			type: String,
			default: "",
		},

		invoice: {
			type: String,
			default: "",
		},

		paymentMethod: {
			type: String,
			default: "",
		},

		gateway: {
			type: String,
			default: "",
		},

		gatewayReference: {
			type: String,
			default: "",
		},

		paymentStatus: {
			type: String,
			enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
			default: "PENDING",
			index: true,
		},

		status: {
			type: String,
			default: "",
		},

		paidAt: {
			type: Date,
			default: null,
		},

		refundAmount: {
			type: Number,
			default: 0,
		},

		refundId: {
			type: String,
			default: "",
		},

		refundDate: {
			type: Date,
			default: null,
		},

		failureReason: {
			type: String,
			default: "",
		},

		responseData: {
			type: mongoose.Schema.Types.Mixed,
			default: {},
		},

		createdAt: {
			type: Date,
			default: Date.now,
		},

		updatedAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

PaymentDetailsSchema.index({ orderId: 1, createdAt: -1 });
PaymentDetailsSchema.index({ paymentId: 1 });

module.exports = mongoose.model(
	"PaymentDetail",
	PaymentDetailsSchema
);
