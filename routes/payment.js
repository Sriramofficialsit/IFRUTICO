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

    const amount = Number(persons) * PRICE_PER_PERSON;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);
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

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false });
    }

    const baseUrl = process.env.BASE_URL || "http://localhost:5173";
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

    const qrData = `${baseUrl}/ticket/${payment._id}`;
    payment.qrCode = qrData;
    const newPayment = await payment.save();

    const qrBuffer = await QRCode.toBuffer(qrData);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Frutico Ticket</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff6b6b, #ffa500); color: #ffffff; padding: 40px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 10px 0 0; font-size: 18px; opacity: 0.9; }
          .content { padding: 30px; text-align: center; }
          .ticket-box { background: #fff9e6; border: 2px dashed #ff9f43; border-radius: 12px; padding: 20px; margin: 20px auto; max-width: 400px; }
          .details { width: 100%; margin: 20px 0; }
          .details td { padding: 10px; font-size: 16px; }
          .label { font-weight: bold; color: #333; text-align: left; }
          .value { text-align: right; color: #555; }
          .qr-section { margin: 30px 0; }
          .qr-section h3 { color: #ff6b6b; margin-bottom: 10px; }
          .instructions { background: #f0f8ff; border-left: 4px solid #ff9f43; padding: 15px; margin: 30px 0; text-align: left; }
          .instructions ul { margin: 10px 0; padding-left: 20px; }
          .instructions li { margin-bottom: 8px; }
          .footer { background: #333; color: #fff; padding: 20px; text-align: center; font-size: 14px; }
          @media (max-width: 600px) {
            .details td { display: block; width: 100%; text-align: center !important; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Ticket Confirmed!</h1>
            <p>Enjoy your delicious Frutico Ice Cream experience 🍦</p>
          </div>
          
          <div class="content">
            <div class="ticket-box">
              <h2 style="color: #ff6b6b; margin-top:0;">Your Frutico Ticket</h2>
              
              <table class="details" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="label">Name:</td>
                  <td class="value">${name}</td>
                </tr>
                <tr>
                  <td class="label">Persons:</td>
                  <td class="value">${persons}</td>
                </tr>
                <tr>
                  <td class="label">Location:</td>
                  <td class="value">${location}</td>
                </tr>
                <tr>
                  <td class="label">Amount Paid:</td>
                  <td class="value">₹${amount}</td>
                </tr>
                <tr>
                  <td class="label">Ticket ID:</td>
                  <td class="value">${newPayment._id
                    .toString()
                    .slice(0, 8)
                    .toUpperCase()}</td>
                </tr>
              </table>
              
              <div class="qr-section">
                <h3>🎫 Scan this QR Code at the counter</h3>
                <img src="cid:frutico-qr" alt="Frutico Ticket QR Code" style="width:220px; height:220px; border:2px solid #ff9f43; border-radius:8px; background:#fff; padding:10px;" />
              </div>
            </div>
            
            <div class="instructions">
              <h4 style="margin-top:0; color:#333;">📌 Important Instructions</h4>
              <ul>
                <li>Show this QR code at the Frutico counter for redemption</li>
                <li>Valid for today only</li>
                <li>One-time use only</li>
                <li>No refunds after scanning</li>
                <li>Keep this email safe as proof of purchase</li>
              </ul>
            </div>
            
            <p style="color:#555; font-size:16px;">Thank you for choosing Frutico! We can't wait to serve you 😊</p>
          </div>
          
          <div class="footer">
            <p>&copy; 2025 Frutico Ice Cream. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(email, "Your Frutico Ice Cream Ticket 🎫", html, [
      {
        filename: "frutico-ticket.png",
        content: qrBuffer,
        cid: "frutico-qr",
      },
    ]);

    res.json({
      success: true,
      message: "Payment verified, QR generated & email sent",
    });
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
