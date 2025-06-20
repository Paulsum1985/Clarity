require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();

app.use(cors({ origin: ['http://localhost:3000', 'https://clarity-4zb9.onrender.com'] }));

// We must define the JSON parser with the verify function BEFORE any routes that need the raw body.
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// A simple test route to make sure the server is running
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
        await userStatusRef.update({ 
          tier: 'pro',
          stripeCustomerId: session.customer 
        });
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
      
      const usersCollectionRef = db.collection(`artifacts/clarity-app-local/users`);
      const q = usersCollectionRef.where('stripeCustomerId', '==', stripeCustomerId);

      try {
        const querySnapshot = await q.get();
        querySnapshot.forEach(async (userDoc) => {
          console.log(`Downgrading user ${userDoc.id} to free plan.`);
          const userStatusRef = userDoc.ref.collection('status').doc('main');
          await userStatusRef.update({ tier: 'free' });
        });
      } catch (error) {
        console.error('Error downgrading user:', error);
      }
      break;
    }
    default:
      // console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).send();
});

// Updated endpoint to create an EMBEDDED checkout session
app.post('/create-checkout-session', async (req, res) => {
    const { userId } = req.body;
  
    try {
      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded', // Add this line for embedded checkout
        payment_method_types: ['card'],
        line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
        mode: 'subscription',
        client_reference_id: userId,
        // The return URL is where the user is sent after completing the checkout in the modal
        return_url: `http://localhost:3000/#my-decisions?session_id={CHECKOUT_SESSION_ID}`,
      });
  
      // For embedded mode, we send back the client_secret
      res.send({ clientSecret: session.client_secret });
    } catch (error) {
      console.error('Error creating Stripe session:', error);
      res.status(500).json({ error: 'Could not create customer portal session' });
    }
});

// New endpoint to create a Billing Portal session
app.post('/create-customer-portal-session', async (req, res) => {
  const { userId } = req.body;

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
      return_url: 'http://localhost:3000/#my-decisions',
    });

    res.json({ url: portalSession.url });

  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ error: 'Could not create customer portal session' });
  }
});


const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));