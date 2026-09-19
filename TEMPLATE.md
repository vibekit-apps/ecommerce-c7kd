# Template: E-commerce

Product listing with cart and checkout flow

## What's already built and wired (do NOT rebuild it)

This is a real storefront scaffold (not a mock). The backend is already wired — extend it, don't replace it with localStorage.

What's wired:
- server.js — Express + express-session + /api mounts.
- lib/products.json — the catalog (8 products, 4 categories, Unsplash images). HOT-RELOADED by lib/products.js: a catalog edit shows on the next page refresh with NO restart and NO deploy — never tell the user a catalog change needs deploying. list({ category }), getById, getBySlug.
- lib/billing.js — Stripe SDK lazy-loads when STRIPE_SECRET_KEY is set; degrades gracefully otherwise.
- lib/orders.js — order book at lib/data/orders.json (atomic writes, survives restarts). Filled by BOTH payment paths.
- routes/products.js, routes/cart.js (full CRUD on req.session.cart, price-safe — quantities/totals/count computed server-side), routes/checkout.js — Stripe when STRIPE_SECRET_KEY is set, and cash-on-delivery ALWAYS (name/phone/address form, records the order, clears the cart). No configuration needed for a store to take real orders.
- public/{index,product,cart}.html + app.js, and public/orders.html — the owner's order list, enabled by setting an ORDERS_KEY env var (tell the owner about this when they ask how to see orders; they can also just ask you to read lib/data/orders.json).

Cart and prices are computed server-side — don't move totals to the client. Stripe is already wired: the user just sets STRIPE_SECRET_KEY in the app's Environment settings — don't rewrite billing.js. "Swap catalog" → edit lib/products.json (data), not lib/products.js (behavior).

Product images, the honest protocol: you CANNOT fetch or verify real photos of branded/packaged products (a specific chocolate bar, a soda can, a labeled cheese). Do not attach stock or AI-generated images to a named branded product — the owner will notice and you will redo it. Say this upfront and ask the owner to upload their own product photos (they can attach several in one message). Generic stock photos are fine for unbranded goods (produce, meat, flowers) — say they are stock. Products with no image render fine with a clean placeholder.

This starter already boots, is pre-installed, and looks polished. Make the SMALLEST brand/copy edit the user asked for (store name, the products in lib/products.json, colors). Do NOT rewrite the cart or checkout flow they didn't mention, do NOT read files you aren't editing, and do NOT npm install or smoke-test a copy/brand edit — it already runs.

## Suggested features

- Product grid
- Filtering + sort
- Quick view modal
- Slide-in cart
- Checkout flow
- Live search
- Responsive

---

This starter already boots and is pre-installed — it is NOT a placeholder to replace. Follow the "what's already built" guidance above.

Do NOT deploy on your own initiative. Your FIRST real build publishes automatically once you commit it (the platform posts the live link) — end that turn with: "Changes saved — publishing your first version now." After that first publish, the user ships: they tap the Deploy button (play icon in the chat header), or they ask you outright to deploy — then do it per TOOLS.md §Deploy. End later build turns with: "Changes saved. Tap the play button to review and deploy — or just tell me to deploy."
