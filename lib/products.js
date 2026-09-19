// Catalog access. The data lives in products.json, NOT in this file, and it
// hot-reloads: every read stat()s the JSON and re-parses when it changed, so
// a catalog edit shows up on the next page refresh with NO server restart.
//
// Why this matters: in a store, the catalog is the thing owners edit most.
// When products lived in a require()d const here, every edit silently waited
// for a redeploy — a real merchant (2026-08-09) spent hours asking "why don't
// I see my products?" because of exactly that. Keep it this way: edit
// products.json for catalog changes; only touch this file to change catalog
// BEHAVIOR.
//
// A malformed products.json never crashes the store: the last good catalog
// keeps serving and the error is logged.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'products.json');

let cache = { mtimeMs: -1, products: [] };

function load() {
  try {
    const { mtimeMs } = fs.statSync(FILE);
    if (mtimeMs !== cache.mtimeMs) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('products.json must be a JSON array');
      cache = { mtimeMs, products: parsed };
    }
  } catch (err) {
    console.error('[products] failed to load products.json, serving last good catalog:', err.message);
  }
  return cache.products;
}

function list({ category } = {}) {
  const products = load();
  if (!category) return products;
  return products.filter((p) => p.category === category);
}

function getById(id) {
  return load().find((p) => p.id === id) || null;
}

function getBySlug(slug) {
  return load().find((p) => p.slug === slug) || null;
}

module.exports = { list, getById, getBySlug };
