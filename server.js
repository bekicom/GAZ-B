const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const mainRoutes = require("./routes/mainRoutes");
const dbConfig = require("./config/dbConfig");
require("dotenv").config();

const app = express();
// sdsd
dbConfig.connectDB();

const corsOptions = {
  origin: [
    "https://gaz-f.vercel.app",
    "http://localhost:3000", // Backend lokal
    "http://localhost:3001", // Backend lokal
    "http://localhost:3002", // Backend lokal
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", ], // Ruxsat etilgan HTTP metodlar
  credentials: true, // Cookie va autentifikatsiya uchun ruxsat
};

app.use(cors(corsOptions));

s
app.options("*", cors(corsOptions));

app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Yo'nalishlar
app.use("/api", mainRoutes);

const PORT = process.env.PORT || 8063;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
