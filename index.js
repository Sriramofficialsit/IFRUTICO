const express = require("express");
const app = express();
const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const paymentRoutes = require("./routes/payment");
const dbconnect = require("./config/db");
const admin = require("./controller/admin.Controller");
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use(express.static("public"));

dbconnect();

app.use("/api", paymentRoutes);
app.use("/admin", admin);

app.listen(process.env.PORT, () =>
  console.log(`Server running on ${process.env.PORT}`)
);
