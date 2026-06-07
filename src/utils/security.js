const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const PASSWORD_PREFIX = "scrypt";

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);

  return `${PASSWORD_PREFIX}$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedPassword) {
  if (!storedPassword?.startsWith(`${PASSWORD_PREFIX}$`)) {
    const received = Buffer.from(String(password));
    const stored = Buffer.from(String(storedPassword));
    return received.length === stored.length && crypto.timingSafeEqual(received, stored);
  }

  const [, salt, storedKey] = storedPassword.split("$");
  const derivedKey = await scrypt(password, salt, 64);
  const storedBuffer = Buffer.from(storedKey, "hex");

  return storedBuffer.length === derivedKey.length
    && crypto.timingSafeEqual(storedBuffer, derivedKey);
}

function isStrongPassword(password) {
  return typeof password === "string"
    && password.length >= 10
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function sanitizeText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

module.exports = {
  hashPassword,
  verifyPassword,
  isStrongPassword,
  sanitizeText
};
