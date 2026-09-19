const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const productsRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const checkoutRoutes = require('./routes/checkout');

const app = express();
const PORT = process.env.PORT || 3000;
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('SESSION_SECRET not set — generated an ephemeral secret. Sessions reset on restart; set SESSION_SECRET in env for stable cookies.');
}

app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 },
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api', productsRoutes);
app.use('/api', cartRoutes);
app.use('/api', checkoutRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Ecommerce starter listening on port ${PORT}`);
});
