const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: String,
    paymentId: String,
    name: String,
    email: String,
    phone: String,
    persons: Number,
    location: String,
    amount: Number,
    qrCode: String,
    isUsed: { type: Boolean, default: false },
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
