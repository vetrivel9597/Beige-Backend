const mongoose = require('mongoose')

const paymentDetailsSchema = new mongoose.Schema({
	userId: {
        type: mongoose.Schema.Types.ObjectId,
    },
	orderId: {
		type: String,
		required: true
	},
	invoiceId: {
		type: String
	},
	paymentId: {
		type: String,
	},
	signature: {
		type: String,
	},
	amount: {
		type: Number
	},
	currency: {
		type: String
	},
	barcode :{
		type: String
	},
	invoice:{
		type: String
	},
	createdAt: {
        type: Date,
        default: Date.now
    },
	status: {
		type: String
	}
})

module.exports = mongoose.model('PaymentDetail', paymentDetailsSchema)