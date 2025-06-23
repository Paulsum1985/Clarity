require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();

// Configure CORS to allow requests from your local and live frontend
app.use(cors({ origin: [process.env.CLIENT_URL || 'http://localhost:3000', 'https://www.clarity-decisions.com'] }));

// We must define the JSON parser with the verify function BEFORE any routes that need the raw body.
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// A simple test route
app.get('/', (req, res) => {
  res.send('Clarity backend server is running!');
});

// Webhook handler for Stripe
app.post('/stripe-webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id;

      if (!userId) {
        console.error('Webhook Error: No userId found in checkout.session.completed');
        break;
      }
      
      console.log(`Payment successful for user: ${userId}`);
      
      const userStatusRef = db.collection(`artifacts/clarity-app-local/users/${userId}/status`).doc('main');
      try {
        await userStatusRef.set({ 
          tier: 'pro',
          stripeCustomerId: session.customer 
        }, { merge: true });
        console.log(`User ${userId} upgraded to Pro plan.`);
      } catch (error) {
        console.error('Error upgrading user to Pro:', error);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      console.log(`Subscription cancelled for customer: ${stripeCustomerId}`);
      
      // Use a collection group query to find the user status regardless of which user it's under
      const querySnapshot = await db.collectionGroup('status').where('stripeCustomerId', '==', stripeCustomerId).get();

      querySnapshot.forEach(async (doc) => {
        console.log(`Downgrading user ${doc.ref.parent.parent.id} to free plan.`);
        await doc.ref.update({ tier: 'free' });
      });
      break;
    }
    default:
      // console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).send();
});

// Endpoint to create a checkout session
app.post('/create-checkout-session', async (req, res) => {
    const { userId, priceId } = req.body;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  
    try {
      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        client_reference_id: userId,
        allow_promotion_codes: true, // This enables the promo code field
        return_url: `${clientUrl}/#my-decisions?session_id={CHECKOUT_SESSION_ID}`,
      });
  
      res.send({ clientSecret: session.client_secret });
    } catch (error) {
      console.error('Error creating Stripe session:', error);
      res.status(500).json({ error: 'Could not create customer portal session' });
    }
});

// Endpoint to create a Billing Portal session
app.post('/create-customer-portal-session', async (req, res) => {
  const { userId } = req.body;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  try {
    const userStatusRef = db.collection(`artifacts/clarity-app-local/users/${userId}/status`).doc('main');
    const docSnap = await userStatusRef.get();

    if (!docSnap.exists) {
      return res.status(404).send('User status not found.');
    }

    const { stripeCustomerId } = docSnap.data();

    if (!stripeCustomerId) {
      return res.status(400).send('Stripe customer ID not found for this user.');
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${clientUrl}/#my-decisions`,
    });

    res.json({ url: portalSession.url });

  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ error: 'Could not create customer portal session' });
  }
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));