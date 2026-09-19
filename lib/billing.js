let stripeClient = null;

function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require('stripe');
  stripeClient = new Stripe(key);
  return stripeClient;
}

async function createCheckoutSession({ lineItems, origin }) {
  const stripe = getStripe();
  if (!stripe) {
    return {
      configured: false,
      message: "Checkout isn't live yet — set STRIPE_SECRET_KEY to accept payments.",
    };
  }
  const sessionObj = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems.map((li) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: li.name, images: li.image ? [li.image] : [] },
        unit_amount: li.price,
      },
      quantity: li.quantity,
    })),
    success_url: `${origin}/?ordered=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart.html`,
  });
  return { configured: true, url: sessionObj.url };
}

async function isSessionPaid(sessionId) {
  const stripe = getStripe();
  if (!stripe) return false;
  const sessionObj = await stripe.checkout.sessions.retrieve(sessionId);
  return !!sessionObj && sessionObj.payment_status === 'paid';
}

module.exports = { createCheckoutSession, isSessionPaid };
