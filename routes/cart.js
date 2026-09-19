const express = require('express');
const products = require('../lib/products');

const router = express.Router();

function ensureCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

function hydrate(items) {
  return items.map((item) => {
    const product = products.getById(item.productId);
    if (!product) return null;
    return {
      productId: item.productId,
      quantity: item.quantity,
      product,
      lineTotal: product.price * item.quantity,
    };
  }).filter(Boolean);
}

function summary(items) {
  const subtotal = items.reduce((acc, i) => acc + i.lineTotal, 0);
  return { items, subtotal, itemCount: items.reduce((a, i) => a + i.quantity, 0) };
}

router.get('/cart', (req, res) => {
  res.json(summary(hydrate(ensureCart(req))));
});

router.post('/cart', (req, res) => {
  const { productId, quantity } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'product_id_required' });
  const qty = Math.min(99, Math.max(1, parseInt(quantity, 10) || 1));
  if (!products.getById(productId)) return res.status(404).json({ error: 'product_not_found' });
  const cart = ensureCart(req);
  const existing = cart.find((i) => i.productId === productId);
  if (existing) existing.quantity += qty;
  else cart.push({ productId, quantity: qty });
  res.json(summary(hydrate(cart)));
});

router.patch('/cart/:productId', (req, res) => {
  const { quantity } = req.body || {};
  const cart = ensureCart(req);
  const item = cart.find((i) => i.productId === req.params.productId);
  if (!item) return res.status(404).json({ error: 'item_not_in_cart' });
  const qty = parseInt(quantity, 10);
  if (!Number.isFinite(qty)) return res.status(400).json({ error: 'invalid_quantity' });
  if (qty <= 0) {
    req.session.cart = cart.filter((i) => i.productId !== req.params.productId);
  } else {
    item.quantity = Math.min(qty, 99);
  }
  res.json(summary(hydrate(req.session.cart)));
});

router.delete('/cart/:productId', (req, res) => {
  const cart = ensureCart(req);
  req.session.cart = cart.filter((i) => i.productId !== req.params.productId);
  res.json(summary(hydrate(req.session.cart)));
});

module.exports = router;
