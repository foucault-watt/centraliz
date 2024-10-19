const express = require("express");
const session = require("express-session");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("../routes/auth");
const csvRoutes = require("../routes/csv");
const claRoutes = require("../routes/cla");
const hpRoutes = require("../routes/hp");
const morgan = require("morgan");
const app = express();

// app.use(morgan('combined'))

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(
  session({
    secret: "monfpizengpzeogn",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.SECURE == "true" }, // Mettez à true si vous utilisez HTTPS
  })
);

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api", csvRoutes);
app.use("/api", claRoutes);
app.use("/api", hpRoutes);

app.post("/api/crash", async (req, res) => {
  res.send("CRASH");
  process.exit(1);
});

module.exports = app;