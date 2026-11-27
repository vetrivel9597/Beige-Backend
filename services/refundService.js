const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createGatewayRefund = async ({
  paymentId,
  amount,
  returnId,
}) => {
  if (!paymentId) {
    throw new Error("Original Razorpay payment ID not found");
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error("Invalid refund amount");
  }

  const refund = await razorpay.payments.refund(paymentId, {
    amount: Math.round(Number(amount) * 100),
    speed: "normal",
    notes: {
      returnId: String(returnId),
    },
  });

  return refund;
};