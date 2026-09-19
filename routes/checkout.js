const express = require('express');
const crypto = require('crypto');
const products = require('../lib/products');
const billing = require('../lib/billing');
const orders = require('../lib/orders');

const router = express.Router();

// Snapshot the session cart against the server-side catalog. Price-safe:
// names/prices come from the catalog, never the client.
function cartLineItems(req) {
  const cart = (req.session && req.session.cart) || [];
  return cart.map((i) => {
    const p = products.getById(i.productId);
    return p && { productId: p.id, name: p.name, image: p.image, price: p.price, quantity: i.quantity };
  }).filter(Boolean);
}

// Two payment paths, chosen by the client per request:
// - default (no method / method:'stripe'): Stripe Checkout when
//   STRIPE_SECRET_KEY is set; degrades to {configured:false} otherwise.
// - method:'cod': cash on delivery — always available, no configuration.
//   Takes the customer's name/phone/address, records the order to
//   lib/data/orders.json, clears the cart, returns the order id.
// COD exists because many stores (and many markets) never take card payment
// online at all; without it, an unconfigured Stripe key made checkout a
// dead end ("Checkout isn't live yet") instead of a completed order.
router.post('/checkout', async (req, res) => {
  try {
    const lineItems = cartLineItems(req);
    if (!lineItems.length) return res.status(400).json({ error: 'cart_empty' });

    if (req.body && req.body.method === 'cod') {
      const c = req.body.customer || {};
      const field = (v, max) => (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null);
      const name = field(c.name, 120);
      const phone = field(c.phone, 40);
      const address = field(c.address, 500);
      if (!name || !phone || !address) {
        return res.status(400).json({ error: 'customer_details_required', fields: ['name', 'phone', 'address'] });
      }
      const subtotal = lineItems.reduce((s, li) => s + li.price * li.quantity, 0);
      const order = orders.create({ items: lineItems, subtotal, customer: { name, phone, address }, method: 'cod' });
      req.session.cart = [];
      return res.json({ ok: true, method: 'cod', orderId: order.id });
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const result = await billing.createCheckoutSession({ lineItems, origin });
    // Do NOT clear the cart here — the Stripe session is only created, not paid.
    // A user who cancels/closes must return to an intact cart. The cart is cleared
    // in /checkout/verify once Stripe confirms payment_status === 'paid'.
    // codAvailable tells the client to offer the cash-on-delivery form when
    // Stripe isn't configured (or alongside it, if the UI wants both).
    res.json({ ...result, codAvailable: true });
  } catch (err) {
    console.error('[checkout] failed:', err && err.message);
    res.status(500).json({ error: 'checkout_failed' });
  }
});

// Called from the success page (success_url) with the Stripe session id.
// Verifies the payment actually completed before emptying the cart, and
// records the paid order so Stripe and COD share one order book.
router.post('/checkout/verify', async (req, res) => {
  try {
    const sessionId = (req.body && req.body.sessionId) || '';
    if (!sessionId) return res.status(400).json({ error: 'session_id_required' });
    const paid = await billing.isSessionPaid(sessionId);
    if (paid) {
      const lineItems = cartLineItems(req);
      if (lineItems.length) {
        const subtotal = lineItems.reduce((s, li) => s + li.price * li.quantity, 0);
        orders.create({ items: lineItems, subtotal, customer: {}, method: 'stripe' });
      }
      req.session.cart = [];
    }
    res.json({ paid });
  } catch (err) {
    console.error('[checkout] verify failed:', err && err.message);
    res.status(500).json({ error: 'verify_failed' });
  }
});

// Owner-only order list, read by /orders.html. Gated by the ORDERS_KEY env
// var (set it in the app's Environment settings): unset → the endpoint does
// not exist, so customer PII can never leak from a store whose owner hasn't
// opted in. Constant-time compare; keys are compared as hashes so length
// differences don't short-circuit.
router.get('/orders', (req, res) => {
  const key = process.env.ORDERS_KEY;
  if (!key) return res.status(404).json({ error: 'orders_view_disabled', hint: 'Set an ORDERS_KEY env var to enable /orders.html' });
  const given = String(req.query.key || '');
  const h = (s) => crypto.createHash('sha256').update(s).digest();
  if (!given || !crypto.timingSafeEqual(h(given), h(key))) {
    return res.status(401).json({ error: 'bad_key' });
  }
  res.json({ orders: orders.list() });
});

module.exports = router;
