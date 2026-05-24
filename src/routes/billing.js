const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { sendPurchaseConfirmation } = require('../services/email');

const router = express.Router();

// Get balance and transaction history
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT balance_tfc FROM users WHERE id = $1',
      [req.userId]
    );

    const transactionsResult = await db.query(
      `SELECT type, amount_tfc, description, created_at 
       FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.userId]
    );

    res.json({
      balance_tfc: parseFloat(userResult.rows[0].balance_tfc),
      transactions: transactionsResult.rows
    });
  } catch (err) {
    console.error('Balance error:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Create Stripe checkout session
router.post('/checkout', authenticateToken, authLimiter, async (req, res) => {
  const { amount } = req.body; // amount in USD (e.g., 10 for $10)

  if (!amount || amount < 5 || amount > 500) {
    return res.status(400).json({ error: 'Amount must be between $5 and $500' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'TFC Credits',
            description: `${amount} TFC credits for TokenForge`
          },
          unit_amount: amount * 100 // cents
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard?canceled=true`,
      metadata: {
        userId: req.userId,
        amountTfc: amount
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency check
  const eventId = event.id;
  const existingEvent = await db.query('SELECT id FROM stripe_events WHERE id = $1', [eventId]);
  if (existingEvent.rows.length > 0) {
    console.log('Duplicate webhook event, skipping:', eventId);
    return res.json({ received: true });
  }

  // Mark event as processed
  await db.query('INSERT INTO stripe_events (id) VALUES ($1)', [eventId]);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Verify payment status
    if (session.payment_status !== 'paid') {
      console.log(`Payment not completed for session ${session.id}, status: ${session.payment_status}`);
      return res.json({ received: true });
    }
    
    const userId = session.metadata.userId;
    const amountTfc = parseFloat(session.metadata.amountTfc);

    try {
      // Add TFC to user balance
      await db.query(
        'UPDATE users SET balance_tfc = balance_tfc + $1 WHERE id = $2',
        [amountTfc, userId]
      );

      // Record transaction
      await db.query(
        'INSERT INTO transactions (user_id, type, amount_tfc, description, stripe_session_id) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'purchase', amountTfc, `Purchased ${amountTfc} TFC via Stripe`, session.id]
      );

      // Get user email for confirmation
      const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        const newBalance = await db.query('SELECT balance_tfc FROM users WHERE id = $1', [userId]);
        await sendPurchaseConfirmation(
          userResult.rows[0].email,
          amountTfc,
          parseFloat(newBalance.rows[0].balance_tfc)
        );
      }

      console.log(`Added ${amountTfc} TFC to user ${userId}`);
    } catch (err) {
      console.error('Webhook processing error:', err);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  res.json({ received: true });
});

module.exports = router;
