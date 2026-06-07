const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.set({
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
  next();
});

app.use(express.json({ limit: "100kb", strict: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const expectedOrigin = `${req.protocol}://${req.get("host")}`;
    if (origin && origin !== expectedOrigin) {
      return res.status(403).json({ error: "Origem da requisição não permitida." });
    }
  }
  next();
});

app.use("/pages", (req, res, next) => {
  if (req.path.endsWith("/index.html")) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(path.join(__dirname, "public"), {
  dotfiles: "deny",
  index: false,
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.use("/", require("./routes/routes"));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (!error.status || error.status >= 500) console.error(error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : "Erro interno no servidor."
  });
});

module.exports = app;
