// Order store: JSON file on EFS (survives restarts), same pattern as the
// tracker template's items store. Writes are atomic (tmp file + rename) so a
// restart mid-write can never corrupt the order book.
//
// Orders are created by cash-on-delivery checkout (routes/checkout.js) and by
// the Stripe verify step. The owner reads them at /orders.html (gated by the
// ORDERS_KEY env var) or by asking their agent to read lib/data/orders.json.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'orders.json');

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeAll(orders) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(orders, null, 2));
  fs.renameSync(tmp, FILE);
}

let seq = 0;

/**
 * items: [{ productId, name, price, quantity }] — snapshot of the cart at
 * order time (price-safe: taken from the server-side catalog, never the
 * client). customer: { name, phone, address } for COD; {} for Stripe orders
 * (Stripe holds the payer details).
 */
function create({ items, subtotal, customer = {}, method }) {
  const orders = readAll();
  const id = `ORD-${Date.now().toString(36).toUpperCase()}${(seq++ % 36).toString(36).toUpperCase()}`;
  const order = {
    id,
    method, // 'cod' | 'stripe'
    status: 'new',
    items,
    subtotal,
    customer,
    createdAt: new Date().toISOString(),
  };
  orders.unshift(order);
  writeAll(orders);
  return order;
}

function list() {
  return readAll();
}

module.exports = { create, list };
