var express = require('express');
const Razorpay = require('razorpay')
const PaymentDetail = require('../models/payment-details');
const User = require('../models/User');
const Orders = require('../models/Orders');
const Cart = require('../models/usercart');
const product = require('../models/Product');
let crypto = require("crypto");
const SellProduct = require('../models/sellProduct');
const fs = require('fs');
const path = require('path');
const nodemailer = require("nodemailer");
const handleBars = require("handlebars");
const siteSetting = require('../models/siteSetting');
const pdf = require('html-pdf-node');
const siteAddress = require('../models/address');
const bwipjs = require('bwip-js');
const cloudinary = require('cloudinary').v2; // Make sure to require Cloudinary
const { createCanvas } = require('canvas'); // Import canvas for server-side use
const JsBarcode = require('jsbarcode');


let razorPayInstance = new Razorpay({
	key_id: process.env.RAZORPAY_KEY_ID,
	key_secret: process.env.RAZORPAY_KEY_SECRET
})

async function generatePdf(htmlContent) {
	let options = { format: 'A4' };
	let file = { content: htmlContent };

	return new Promise((resolve, reject) => {
		pdf.generatePdf(file, options, (error, buffer) => {
			if (error) {
				return reject(error);
			}
			resolve(buffer);
		});
	});
}

exports.order = async (req, res) => {
	const userID = res.locals.user_id;

	try {
		if (!userID) return res.status(401).json({ status: false, message: 'Sign in before checkout.' });
		if (req.body?.currency && req.body.currency !== 'INR') {
			return res.status(400).json({ status: false, message: 'Only INR checkout is supported.' });
		}
		const findUser = await User.findById(userID).select('username email mobile default_address other_address');
		if (!findUser) return res.status(401).json({ status: false, message: 'User account not found.' });

		const addressId = String(req.body?.addressId || '');
		let addressData;
		if (addressId === String(findUser._id) && findUser.default_address) {
			addressData = {
				name: findUser.username,
				mobile: findUser.mobile,
				email: findUser.email,
				address: findUser.default_address,
			};
		} else {
			const savedAddress = findUser.other_address.find((address) => String(address._id) === addressId);
			if (!savedAddress) return res.status(400).json({ status: false, message: 'Select a saved delivery address.' });
			addressData = {
				name: `${savedAddress.firstname || ''} ${savedAddress.lastname || ''}`.trim(),
				mobile: savedAddress.mobilenumber,
				email: findUser.email,
				address: savedAddress.address,
			};
		}

		const cart = await Cart.findOne({ userid: userID }).populate('product.productid');
		if (!cart?.product?.length) return res.status(400).json({ status: false, message: 'Your cart is empty.' });
		const orderProducts = [];
		let subtotal = 0;
		for (const item of cart.product) {
			const currentProduct = item.productid;
			const quantity = Number(item.quantity);
			if (!currentProduct || currentProduct.productStatus !== 1 || !Number.isInteger(quantity) || quantity < 1) {
				return res.status(409).json({ status: false, message: 'A cart item is no longer available. Refresh your cart.' });
			}
			if (quantity > Number(currentProduct.quantity || 0)) {
				return res.status(409).json({ status: false, message: `${currentProduct.productname} does not have enough stock.` });
			}
			const unitPrice = Number(currentProduct.discount_price || currentProduct.final_price || currentProduct.price);
			if (!Number.isFinite(unitPrice) || unitPrice < 0) {
				return res.status(409).json({ status: false, message: 'A cart item has an invalid price.' });
			}
			subtotal += unitPrice * quantity;
			orderProducts.push({
				productid: currentProduct._id,
				category: currentProduct.category,
				productname: currentProduct.productname,
				productimages: currentProduct.productimages,
				productdetails: [{
					price: Number(currentProduct.price || 0),
					gstPrice: Number(currentProduct.gst_price || 0),
					size: currentProduct.size,
					shade: currentProduct.shade,
					quantity,
					discount_price: Number(currentProduct.discount_price || currentProduct.final_price || currentProduct.price),
				}],
			});
		}

		const settings = await siteSetting.findOne({}).select('tax_Rate ShippingCharge').lean();
		const gstValue = Number(settings?.tax_Rate || 0);
		const shippingCharge = Number(settings?.ShippingCharge || 0);
		const couponDiscount = Math.min(100, Math.max(0, Number(cart.CouponDiscount || 0)));
		const couponDiscountAmount = Number((subtotal * couponDiscount / 100).toFixed(2));
		const totalAmount = Number(Math.max(0, subtotal - couponDiscountAmount + shippingCharge).toFixed(2));
		if (totalAmount <= 0) return res.status(400).json({ status: false, message: 'The checkout total is invalid.' });

		const invoiceId = `#NEWME_${require('crypto').randomBytes(6).toString('hex').toUpperCase()}`;
		const order = await razorPayInstance.orders.create({
			amount: Math.round(totalAmount * 100),
			currency: 'INR',
			receipt: invoiceId,
		});
		await PaymentDetail.create({ userId: userID, orderId: order.id, invoiceId, amount: totalAmount, currency: order.currency, status: order.status });
		await Orders.create({
			userid: userID,
			orderId: order.id,
			invoiceId,
			product: orderProducts,
			delivery_Address: addressData,
			productStatus: 'Order Pending',
			amount: totalAmount,
			shippingCharge,
			gstPercentage: gstValue,
			totalDiscount: couponDiscountAmount,
			couponDiscount,
			promoCode: cart.promoCode || '',
			couponDiscountAmount,
		});
		return res.status(201).json({
			status: true,
			order,
			findUser: { username: findUser.username, email: findUser.email, mobile: findUser.mobile },
			keyId: process.env.RAZORPAY_KEY_ID,
		});
	} catch (error) {
		console.error("Error creating order:", error);
		res.status(500).json({ success: false, message: "Something went wrong", });
	}
}

async function sendInvoiceEmail(recipientEmail, invoiceData) {

	const invoiceTemplateSource = fs.readFileSync(path.join(__dirname, '../EmailTemplates/invoice_template.html'), 'utf8');
	const invoiceTemplate = handleBars.compile(invoiceTemplateSource);
	const html = invoiceTemplate(invoiceData);

	const pdfBuffer = await generatePdf(html);
	const pdfPath = path.join(__dirname, `../public/Assets/invoices/${invoiceData.orderId}.pdf`);
	fs.writeFileSync(pdfPath, pdfBuffer);


	const transporter = nodemailer.createTransport({
		host: process.env.SMTP_HOST,
		port: Number(process.env.SMTP_INVOICE_PORT),
		secure: process.env.SMTP_INVOICE_SECURE === 'true',
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASSWORD
		},
	});

	let mailOptions = {
		from: process.env.SMTP_FROM,
		to: recipientEmail,
		subject: "Invoice",
		text: 'Thank you for your purchase! If you have any questions, please feel free to contact us',
		attachments: [
			{
				filename: `${invoiceData.orderId}.pdf`,
				path: pdfPath // Attach the stored PDF file
			}
		]
	};

	// console.log("mailOptions---", mailOptions);

	try {
		let info = await transporter.sendMail(mailOptions);
		console.log('Email sent:', info.response);
	} catch (error) {
		console.error('Error sending email:', error);
	}
}


exports.verify = async (req, res) => {
	const userID = res.locals.user_id;

	try {
		if (!userID) return res.status(401).json({ status: false, message: 'Sign in before verifying payment.' });
		const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature } = req.body || {};
		if (![razorpayOrderId, razorpayPaymentId, razorpaySignature].every((value) => typeof value === 'string' && value.trim())) {
			return res.status(400).json({ status: false, message: 'Payment verification details are incomplete.' });
		}
		const paymentRecord = await PaymentDetail.findOne({ orderId: razorpayOrderId, userId: userID });
		if (!paymentRecord) return res.status(404).json({ status: false, message: 'Payment order was not found for this account.' });
		if (paymentRecord.status === 'paid') return res.status(200).json({ status: true, message: 'Payment was already verified.' });
		const body = `${razorpayOrderId}|${razorpayPaymentId}`;
		const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
			.update(body)
			.digest('hex');
		const expectedBuffer = Buffer.from(expectedSignature, 'hex');
		const receivedBuffer = /^[0-9a-f]{64}$/i.test(razorpaySignature) ? Buffer.from(razorpaySignature, 'hex') : Buffer.alloc(0);

		if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
			return res.status(400).json({ status: false, message: 'Payment verification failed.' });
		}
		{
			const addressData = await siteAddress.findOne({}).lean() || {};
				const updatedPayment = await PaymentDetail.findOneAndUpdate(
					{ orderId: razorpayOrderId, userId: userID, status: { $ne: 'paid' } },
					{
						paymentId: razorpayPaymentId,
						signature: razorpaySignature,
						status: "paid"
					},
					{ new: true }
				);

				if (updatedPayment) {
					const findProduct = await Orders.findOne({ orderId: razorpayOrderId, userid: userID });
					if (!findProduct) return res.status(404).json({ status: false, message: 'Order record was not found for this account.' });
					const updatedStatus = await Orders.findOneAndUpdate(
						{ orderId: razorpayOrderId, userid: userID },
						{
							productStatus: "Order Confirmed",
							deliveryStatus: "pending"
						},
						{ new: true }
					);

					await Cart.updateOne(
						{ userid: userID },
						{
							$set: { product: [] },
							$unset: { CouponDiscount: 0, promoCode: "" }
						}
					);


					if (findProduct && findProduct.product) {
						for (const orderedProduct of findProduct.product) {
							const productId = orderedProduct.productid;
							const orderQuantity = orderedProduct.productdetails[0].quantity;
							const productname = orderedProduct.productname;

							await SellProduct.findOneAndUpdate(
								{ productId: productId },
								{
									$inc: { quantity: orderQuantity },
									$setOnInsert: { productname: productname }
								},
								{ upsert: true, new: true }
							);

							await product.updateOne(
								{ _id: productId },
								{ $inc: { quantity: -orderQuantity } }
							);
						}



						const canvas = createCanvas();  // Create a canvas instance
						const orderId = findProduct.orderId; // Example data point
						const productNames = findProduct.product.map(p => p.productname).join(', '); // Get all product names
						
						// Combine the data into a single string
						

						// Generate barcode with JsBarcode
						JsBarcode(canvas, orderId, {
							format: "CODE128",          // Barcode type (CODE128 is a common one)
							lineColor: "#000",          // Barcode color
							width: 2,                   // Width of each bar
							height: 100,                 // Height of the barcode
							displayValue: false,         // Whether to show human-readable value
							margin: 5,                 // Add margin around the barcode
						});
						const barcodeBase64 = canvas.toDataURL("image/png");

						const uploadResponse = await cloudinary.uploader.upload(barcodeBase64, {
							folder: 'skincare',
							public_id: `barcode_${findProduct.orderId}`,
							overwrite: true,
						});


						const barcodeUrl = uploadResponse.secure_url;
						

						const invoiceHtml = {
			logoUrl: process.env.CLOUDINARY_IMAGE_URL,
							siteName : addressData.siteName,
							address : addressData.address,
							mobile : addressData.mobile,
							email : addressData.email,
							barcode: barcodeBase64,
							orderId: findProduct.orderId,
							invoiceId: findProduct.invoiceId,
							orderDate: findProduct.orderdate.toISOString().split('T')[0],
							amount: findProduct.amount,
							customerName: findProduct.delivery_Address.name,
							customerPhone: findProduct.delivery_Address.mobile,
							customerAddress: findProduct.delivery_Address.address,
							customerEmail: findProduct.delivery_Address.email,
							products: findProduct.product.map(p => ({
								productName: p.productname.toUpperCase(),
								quantity: p.productdetails[0].quantity,
								unitPrice: p.productdetails[0].price,
								netPrice: p.productdetails[0].price * p.productdetails[0].quantity,
								discount: p.productdetails[0].discount_price > 0 ? Math.round((p.productdetails[0].discount_price * p.productdetails[0].quantity)) : null,
								taxRate: findProduct.gstPercentage,
								taxAmount: Math.round((p.productdetails[0].price * p.productdetails[0].quantity) * findProduct.gstPercentage / 100),
								totalPrice: p.productdetails[0].discount_price > 0
									? Math.round(((p.productdetails[0].price * p.productdetails[0].quantity)
										- Math.round((p.productdetails[0].discount_price * p.productdetails[0].quantity)))
										+ ((p.productdetails[0].price * p.productdetails[0].quantity) * findProduct.gstPercentage / 100))
									: Math.round((p.productdetails[0].price * p.productdetails[0].quantity)
										+ ((p.productdetails[0].price * p.productdetails[0].quantity) * findProduct.gstPercentage / 100))
							})),

							shippingCharges: findProduct.shippingCharge ? findProduct.shippingCharge : null,
							finalAmount: findProduct.amount,
							barcode: barcodeBase64,
							couponDiscount: findProduct.couponDiscount ? findProduct.couponDiscount : null,
							coupDiscAmt: findProduct.couponDiscountAmount ? findProduct.couponDiscountAmount : null
						};

						await PaymentDetail.findOneAndUpdate(
							{ orderId: razorpayOrderId, userId: userID },
							{
								barcode: barcodeUrl,
							},
							{ new: true }
						);

						await Orders.findOneAndUpdate(
							{ orderId: razorpayOrderId, userid: userID },
							{
								barcode: barcodeUrl,
							},
							{ new: true }
						);

						await sendInvoiceEmail(findProduct.delivery_Address.email, invoiceHtml);

					}

					res.status(200).json({ status: true, message: "Payment verification successful" });
			} else {
				res.status(500).json({ status: false, message: "Payment verification failed" });
			}
		}

	} catch (error) {
		console.error("Error verify:", error);
		res.status(500).json({ success: false, message: "Something went wrong", });
	}
};
