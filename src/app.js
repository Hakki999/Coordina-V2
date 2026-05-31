const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "./public")));

app.use("/", require("./routes/routes"));

module.exports = app;