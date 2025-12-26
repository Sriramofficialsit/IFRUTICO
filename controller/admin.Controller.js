const express = require("express");
require("dotenv").config();
const admin = express.Router();
const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff.model");
const ticket = require("../models/Payment");
const authMiddleware = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");

admin.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const staffMember = await Staff.findOne({ email });

    if (!staffMember) {
      return res.status(400).json({ message: "Invalid User" });
    }

    const isMatch = await bcrypt.compare(password, staffMember.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: staffMember._id,
        email: staffMember.email,
        role: staffMember.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      staff: {
        id: staffMember._id,
        email: staffMember.email,
        role: staffMember.role,
      },
    });
  } catch (error) {
    console.error("STAFF LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});
admin.post("/register", authMiddleware, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existingStaff = await Staff.findOne({
      where: { email },
    });

    if (existingStaff) {
      return res.status(400).json({ message: "Staff member already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newStaff = await Staff.create({
      name,
      email,
      password: hashedPassword,
      role: "staff",
    });

    res.status(201).json({
      message: "Staff member registered successfully",
      staff: {
        id: newStaff.id,
        email: newStaff.email,
        role: newStaff.role,
      },
    });
  } catch (error) {
    console.error("STAFF REGISTER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});
admin.get("/staff", authMiddleware, async (req, res) => {
  try {
    const staffMembers = await Staff.find({ role: "staff" });

    res.status(200).json({ staff: staffMembers });
  } catch (error) {
    console.error("FETCH STAFF ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});
admin.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const staffMember = await Staff.findById(id);
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    await Staff.findByIdAndDelete(id);

    res.status(200).json({ message: "Staff member deleted successfully" });
  } catch (error) {
    console.error("DELETE STAFF ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});
admin.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const staffMember = await Staff.findById(id);
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    staffMember.name = name || staffMember.name;
    staffMember.email = email || staffMember.email;

    if (password) {
      staffMember.password = await bcrypt.hash(password, 10);
    }

    await staffMember.save();

    res.status(200).json({
      message: "Staff member updated successfully",
      staff: staffMember,
    });
  } catch (error) {
    console.error("UPDATE STAFF ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});
admin.get("/tickets", authMiddleware, async (req, res) => {
  const tickets = await ticket.find().sort({ createdAt: -1 });
  res.json({ data: tickets, success: true });
});

admin.get("/tickets/count", authMiddleware, async (req, res) => {
  try {
    const count = await ticket.countDocuments();
    res.json({ totalTickets: count });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

admin.put("/tickets/redeem/:id", authMiddleware, async (req, res) => {
  try {
    const ticketData = await ticket.findOneAndUpdate(
      { _id: req.params.id, isUsed: false },
      { isUsed: true },
      { new: true }
    );

    if (!ticketData) {
      return res.status(400).json({
        message: "Ticket already used or not found",
      });
    }

    res.json({
      message: "Ticket redeemed successfully",
      data: ticketData,
      success: true,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = admin;
