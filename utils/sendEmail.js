const nodemailer = require("nodemailer");

// Recommended settings for Hostinger (Titan Email)
const transporter = nodemailer.createTransport({
  host: "smtp.titan.email",        // More reliable than smtp.hostinger.com
  port: 587,
  secure: false,                   // TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Optional: Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to take messages");
  }
});

module.exports = async (to, subject, html, attachments = []) => {
  const mailOptions = {
    from: `"Frutico Ice Cream" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments,
  };

  await transporter.sendMail(mailOptions);
};
