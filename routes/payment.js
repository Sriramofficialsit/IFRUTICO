const express = require("express");
const crypto = require("crypto");
const razorpay = require("../utils/razorpay");
const Payment = require("../models/Payment");
const QRCode = require("qrcode");
const sendEmail = require("../utils/sendEmail");

const router = express.Router();
const PRICE_PER_PERSON = 99;

router.post("/create-order", async (req, res) => {
  try {
    const { persons } = req.body;

    if (!persons || isNaN(persons) || persons < 1) {
      return res.status(400).json({ error: "Invalid number of persons" });
    }

    const amount = Number(persons) * PRICE_PER_PERSON;

    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay expects paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      name,
      email,
      phone,
      persons,
      location,
      amount,
    } = req.body;

    // Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    // Save payment record
    const payment = new Payment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      name,
      email,
      phone,
      persons,
      location,
      amount,
      status: "paid",
    });

    const baseUrl = process.env.BASE_URL || "https://yourdomain.com"; // Use HTTPS in production!
    const ticketUrl = `${baseUrl}/ticket/${payment._id}`;

    payment.qrCode = ticketUrl;
    const savedPayment = await payment.save();

    // Generate QR code buffer
    const qrBuffer = await QRCode.toBuffer(ticketUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000",
        light: "#FFF",
      },
    });

    // Unique CID to avoid conflicts
    const qrCid = `frutico_qr_${savedPayment._id}`;

    // Email HTML template
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Frutico Ticket</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background:#f9f9f9; margin:0; padding:20px; }
          .container { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
          .header { background:linear-gradient(135deg,#ff6b6b,#ffa500); color:#fff; padding:40px 20px; text-align:center; }
          .header h1 { margin:0; font-size:28px; }
          .content { padding:30px; text-align:center; }
          .ticket { background:#fff9e6; border:2px dashed #ff9f43; border-radius:12px; padding:25px; margin:20px auto; max-width:420px; }
          table { width:100%; margin:20px 0; }
          td.label { font-weight:bold; text-align:left; padding:8px 0; color:#333; }
          td.value { text-align:right; color:#555; }
          .qr-section { margin:30px 0; }
          .qr-section img { width:220px; height:220px; padding:10px; background:#fff; border:2px solid #ff9f43; border-radius:8px; }
          .instructions { background:#f0f8ff; border-left:4px solid #ff9f43; padding:15px; text-align:left; margin:30px 0; }
          .footer { background:#333; color:#ccc; padding:20px; text-align:center; font-size:14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Ticket Confirmed!</h1>
            <p>Enjoy your delicious Frutico Ice Cream 🍦</p>
          </div>
          <div class="content">
            <div class="ticket">
              <h2 style="color:#ff6b6b;">Your Frutico Ticket</h2>
              <table cellpadding="0" cellspacing="0">
                <tr><td class="label">Name:</td><td class="value">${name}</td></tr>
                <tr><td class="label">Persons:</td><td class="value">${persons}</td></tr>
                <tr><td class="label">Location:</td><td class="value">${location}</td></tr>
                <tr><td class="label">Amount Paid:</td><td class="value">₹${amount}</td></tr>
                <tr><td class="label">Ticket ID:</td><td class="value">${savedPayment._id.toString().slice(0, 8).toUpperCase()}</td></tr>
              </table>
              <div class="qr-section">
                <h3 style="color:#ff6b6b;">🎫 Scan at counter</h3>
                <img src="cid:${qrCid}" alt="QR Code" />
                <p style="margin-top:15px; color:#666;">
                  <small>Or visit: <a href="${ticketUrl}">${ticketUrl}</a></small>
                </p>
              </div>
            </div>
            <div class="instructions">
              <h4 style="margin-top:0; color:#333;">📌 Important</h4>
              <ul>
                <li>Show this QR code at the Frutico counter</li>
                <li>Valid only today • One-time use</li>
                <li>No refunds after scanning</li>
                <li>Keep this email as proof</li>
              </ul>
            </div>
            <p style="color:#555;">Thank you for choosing Frutico! 😊</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Frutico Ice Cream. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email with embedded QR
    await sendEmail(
      email,
      "Your Frutico Ice Cream Ticket 🎫",
      html,
      [
        {
          filename: "frutico-ticket-qr.png",
          content: qrBuffer,
          cid: qrCid,
        },
      ]
    );

    res.json({
      success: true,
      ticketId: savedPayment._id,
      message: "Payment successful! Ticket emailed.",
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
