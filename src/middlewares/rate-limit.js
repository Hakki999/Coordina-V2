function rateLimit({ windowMs, max, message }) {
  const requests = new Map();
  let lastCleanup = Date.now();

  return (req, res, next) => {
    const now = Date.now();
    if (now - lastCleanup > windowMs) {
      for (const [storedKey, value] of requests) {
        if (value.expiresAt <= now) requests.delete(storedKey);
      }
      lastCleanup = now;
    }

    const key = req.ip;
    const current = requests.get(key);

    if (!current || current.expiresAt <= now) {
      requests.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      res.set("Retry-After", Math.ceil((current.expiresAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

module.exports = rateLimit;
