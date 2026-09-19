const store = (() => {
  function money(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data };
  }

  async function refreshCartCount() {
    const el = document.getElementById('cart-count');
    if (!el) return;
    const { ok, data } = await api('/api/cart');
    el.textContent = ok && data ? data.itemCount : 0;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // Ask Unsplash for a right-sized WebP instead of the stock 800px JPEG: each
  // surface (grid card, PDP hero, cart thumb) requests only the width it shows,
  // and `auto=format` serves WebP. Cuts image weight ~60-70% — the page's dominant
  // cost. Non-Unsplash URLs pass through untouched.
  function sized(url, w) {
    if (!url || url.indexOf('images.unsplash.com') === -1) return url;
    return url.split('?')[0] + '?w=' + w + '&q=70&auto=format';
  }

  function productCard(p) {
    return `
      <a class="product-card" href="/product.html?slug=${p.slug}">
        <div class="product-image" style="background-image: url('${esc(sized(p.image, 400))}')"></div>
        <div class="product-info">
          <div class="product-name">${esc(p.name)}</div>
          <div class="product-price">${money(p.price)}</div>
        </div>
      </a>`;
  }

  async function confirmOrderIfNeeded() {
    const params = new URLSearchParams(location.search);
    if (params.get('ordered') !== '1') return;
    const banner = document.getElementById('order-banner');
    const sessionId = params.get('session_id');
    let paid = false;
    if (sessionId) {
      const { ok, data } = await api('/api/checkout/verify', { method: 'POST', body: { sessionId } });
      paid = !!(ok && data && data.paid);
    }
    if (banner) {
      banner.hidden = false;
      banner.textContent = paid
        ? 'Order confirmed. Thanks for your purchase!'
        : "We couldn't confirm payment for that session. If you were charged, contact support.";
      banner.classList.toggle('success', paid);
    }
    // Clean the query string so a refresh doesn't re-trigger the banner.
    history.replaceState({}, '', location.pathname);
    refreshCartCount();
  }

  async function bindHome() {
    refreshCartCount();
    confirmOrderIfNeeded();
    const grid = document.getElementById('product-grid');
    const cats = document.querySelectorAll('.cat');

    async function render(cat) {
      const url = cat ? `/api/products?category=${cat}` : '/api/products';
      const { ok, data } = await api(url);
      if (!ok || !data || !Array.isArray(data.products)) {
        grid.innerHTML = '<p class="muted">Couldn\'t load products. Please refresh.</p>';
        return;
      }
      grid.innerHTML = data.products.length
        ? data.products.map(productCard).join('')
        : '<p class="muted">No products in this category yet.</p>';
    }

    cats.forEach((btn) => {
      btn.addEventListener('click', () => {
        cats.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        render(btn.dataset.cat);
      });
    });

    // Honor ?category=… (e.g. arriving from a product-page breadcrumb) by
    // pre-selecting that filter instead of defaulting to "All".
    const initialCat = new URLSearchParams(location.search).get('category') || '';
    cats.forEach((b) => b.classList.toggle('active', (b.dataset.cat || '') === initialCat));
    render(initialCat);
  }

  // Deterministic demo rating so the number is stable across reloads (not
  // random social proof). Swap for real review data when you have it.
  function pseudoRating(p) {
    let h = 0;
    const s = String(p.id || p.slug || p.name);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return { score: (4.3 + (h % 7) / 10).toFixed(1), count: 28 + (h % 385) };
  }

  function starRow(score) {
    const full = Math.round(Number(score));
    let out = '';
    for (let i = 1; i <= 5; i++) out += `<span class="star${i <= full ? ' on' : ''}">★</span>`;
    return out;
  }

  async function bindProductPage() {
    refreshCartCount();
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    const page = document.getElementById('product-page');
    if (!slug) {
      page.innerHTML = '<p>No product specified.</p>';
      return;
    }
    const { ok, data } = await api(`/api/products/${slug}`);
    if (!ok) {
      page.innerHTML = '<p>Product not found.</p>';
      return;
    }
    const p = data.product;
    const rating = pseudoRating(p);

    // Related products: same category first, then fill from the rest, minus self.
    let related = [];
    const list = await api('/api/products');
    if (list.ok && list.data && Array.isArray(list.data.products)) {
      const others = list.data.products.filter((x) => x.id !== p.id);
      const same = others.filter((x) => x.category === p.category);
      related = same.concat(others.filter((x) => x.category !== p.category)).slice(0, 4);
    }

    page.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Store</a>
        <span aria-hidden="true">/</span>
        <a href="/?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a>
        <span aria-hidden="true">/</span>
        <span class="current">${esc(p.name)}</span>
      </nav>
      <div class="product-detail">
        <div class="product-hero" style="background-image: url('${esc(sized(p.image, 900))}')"></div>
        <div class="product-meta">
          <div class="muted">${esc(p.category)}</div>
          <h1>${esc(p.name)}</h1>
          <div class="rating" aria-label="Rated ${rating.score} out of 5">
            <span class="stars" aria-hidden="true">${starRow(rating.score)}</span>
            <span class="rating-num">${rating.score}</span>
            <span class="muted small">(${rating.count} reviews)</span>
          </div>
          <div class="product-price lg">${money(p.price)}</div>
          <p>${esc(p.description)}</p>
          <div class="buy-row">
            <div class="qty-stepper" role="group" aria-label="Quantity">
              <button type="button" data-q="-1" aria-label="Decrease quantity">&minus;</button>
              <span id="qty" aria-live="polite">1</span>
              <button type="button" data-q="1" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn primary lg" id="add-btn">
              <svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2.5 3.5h2l2.15 11a1.5 1.5 0 0 0 1.47 1.2h8.4a1.5 1.5 0 0 0 1.47-1.17L21 7.5H6"/></svg>
              Add to cart
            </button>
          </div>
          <div id="add-status" class="add-status small" hidden></div>
          <ul class="assurances">
            <li>Free shipping over $50</li>
            <li>30-day returns</li>
            <li>Secure checkout</li>
          </ul>
        </div>
      </div>
      ${related.length ? `
      <section class="related">
        <h2>You might also like</h2>
        <div class="product-grid">${related.map(productCard).join('')}</div>
      </section>` : ''}`;

    let qty = 1;
    const qtyEl = document.getElementById('qty');
    page.querySelectorAll('.qty-stepper button').forEach((b) => {
      b.addEventListener('click', () => {
        qty = Math.max(1, Math.min(99, qty + Number(b.dataset.q)));
        qtyEl.textContent = qty;
      });
    });
    document.getElementById('add-btn').addEventListener('click', async () => {
      const { ok } = await api('/api/cart', { method: 'POST', body: { productId: p.id, quantity: qty } });
      const status = document.getElementById('add-status');
      status.hidden = false;
      status.textContent = ok ? `Added ${qty} to cart.` : 'Something went wrong.';
      refreshCartCount();
    });
  }

  async function bindCartPage() {
    await renderCart();
  }

  async function renderCart() {
    refreshCartCount();
    const { ok, data } = await api('/api/cart');
    const body = document.getElementById('cart-body');
    if (!ok || !data || !Array.isArray(data.items)) {
      body.innerHTML = `
        <div class="empty-cart">
          <p>Couldn't load your cart. Please refresh.</p>
          <a class="btn primary" href="/">Start shopping</a>
        </div>`;
      return;
    }
    if (!data.items.length) {
      body.innerHTML = `
        <div class="empty-cart">
          <svg class="empty-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2l2.15 11a1.5 1.5 0 0 0 1.47 1.2h8.4a1.5 1.5 0 0 0 1.47-1.17L21 7.5H6"/></svg>
          <p>Your cart is empty.</p>
          <a class="btn primary" href="/">Start shopping</a>
        </div>`;
      return;
    }
    body.innerHTML = `
      <ul class="cart-items">
        ${data.items.map((i) => `
          <li class="cart-item">
            <div class="ci-image" style="background-image: url('${esc(sized(i.product.image, 160))}')"></div>
            <div class="ci-meta">
              <div class="ci-name">${esc(i.product.name)}</div>
              <div class="muted small">${money(i.product.price)} each</div>
            </div>
            <div class="ci-qty">
              <button data-delta="-1" data-id="${i.productId}">−</button>
              <span>${i.quantity}</span>
              <button data-delta="1" data-id="${i.productId}">+</button>
            </div>
            <div class="ci-total">${money(i.lineTotal)}</div>
            <button class="ci-remove" data-remove="${i.productId}">×</button>
          </li>
        `).join('')}
      </ul>
      <div class="cart-summary">
        <div>Subtotal <strong>${money(data.subtotal)}</strong></div>
        <p class="summary-note">Shipping and taxes calculated at checkout.</p>
        <button class="btn primary lg" id="checkout-btn">Checkout</button>
        <div id="checkout-status" class="status" hidden></div>
      </div>`;

    body.querySelectorAll('[data-delta]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const delta = parseInt(btn.dataset.delta, 10);
        const item = data.items.find((i) => i.productId === id);
        await api(`/api/cart/${id}`, { method: 'PATCH', body: { quantity: item.quantity + delta } });
        renderCart();
      });
    });
    body.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/api/cart/${btn.dataset.remove}`, { method: 'DELETE' });
        renderCart();
      });
    });

    document.getElementById('checkout-btn').addEventListener('click', async () => {
      const btn = document.getElementById('checkout-btn');
      const status = document.getElementById('checkout-status');
      btn.disabled = true;
      const { ok, data: result } = await api('/api/checkout', { method: 'POST' });
      btn.disabled = false;
      if (!ok) {
        status.hidden = false;
        status.textContent = 'Checkout failed.';
        return;
      }
      if (result.configured && result.url) {
        window.location.href = result.url;
      } else {
        // Card payments not configured — fall through to cash on delivery
        // instead of dead-ending. The COD form completes a real order.
        showCodForm();
      }
    });

    // Cash-on-delivery form, injected in place of the checkout button.
    // Completes the order via POST /api/checkout {method:'cod'}.
    function showCodForm() {
      const summary = body.querySelector('.cart-summary');
      if (!summary || document.getElementById('cod-form')) return;
      const wrap = document.createElement('form');
      wrap.id = 'cod-form';
      wrap.className = 'cod-form';
      wrap.innerHTML = `
        <h3>Cash on delivery</h3>
        <p class="muted small">Pay when your order arrives. We'll call to confirm.</p>
        <input name="name" placeholder="Full name" required maxlength="120" autocomplete="name">
        <input name="phone" placeholder="Phone number" required maxlength="40" autocomplete="tel" inputmode="tel">
        <textarea name="address" placeholder="Delivery address" required maxlength="500" rows="3" autocomplete="street-address"></textarea>
        <button class="btn primary lg" type="submit">Place order</button>
        <div class="status" id="cod-status" hidden></div>`;
      const checkoutBtn = document.getElementById('checkout-btn');
      if (checkoutBtn) checkoutBtn.hidden = true;
      const stat = document.getElementById('checkout-status');
      if (stat) stat.hidden = true;
      summary.appendChild(wrap);
      wrap.querySelector('input[name="name"]').focus();
      wrap.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codStatus = document.getElementById('cod-status');
        const fd = new FormData(wrap);
        const customer = { name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address') };
        const submitBtn = wrap.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const { ok, data: result } = await api('/api/checkout', { method: 'POST', body: { method: 'cod', customer } });
        submitBtn.disabled = false;
        if (!ok || !result || !result.orderId) {
          codStatus.hidden = false;
          codStatus.textContent = 'Could not place the order. Check the fields and try again.';
          return;
        }
        body.innerHTML = `
          <div class="empty-cart">
            <p><strong>Order placed.</strong></p>
            <p>Your order number is <strong>${esc(result.orderId)}</strong>. We'll contact you at ${esc(String(customer.phone))} to confirm delivery.</p>
            <a class="btn primary" href="/">Keep shopping</a>
          </div>`;
        refreshCartCount();
      });
    }
  }

  return { bindHome, bindProductPage, bindCartPage };
})();
