const express = require('express');
const products = require('../lib/products');

const router = express.Router();

router.get('/products', (req, res) => {
  const { category } = req.query;
  res.json({ products: products.list({ category }) });
});

router.get('/products/:slug', (req, res) => {
  const p = products.getBySlug(req.params.slug);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json({ product: p });
});

module.exports = router;
