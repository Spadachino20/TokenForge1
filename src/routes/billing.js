const express = require('express');
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

// ==================== CRYPTO PAYMENT ENDPOINTS ====================

// TEST endpoint - returns mock payment URL (for development)
router.post('/create-invoice-test', authenticateToken, authLimiter, async (req, res) => {
  const { monto } = req.body;

  if (!monto || monto < 10 || monto > 10000) {
    return res.status(400).json({ error: 'Amount must be between $10 and $10,000' });
  }

  try {
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      console.error(`User not found: ${req.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const userEmail = userResult.rows[0].email;
    console.log(`[Crypto Payment TEST] User: ${req.userId}, Email: ${userEmail}, Amount: ${monto}`);

    const testPaymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/test-payment-success.html?amount=${monto}&user=${req.userId}&email=${encodeURIComponent(userEmail)}&test=true`;
    
    console.log(`[Crypto Payment TEST] Returning test URL: ${testPaymentUrl}`);
    res.json({ paymentUrl: testPaymentUrl });

  } catch (err) {
    console.error('[Crypto Payment TEST] Unexpected error:', err.message);
    res.status(500).json({ error: 'Failed to process payment request', details: err.message });
  }
});

// PRODUCTION endpoint - calls NOWPayments API directly
router.post('/create-invoice', authenticateToken, authLimiter, async (req, res) => {
  const { monto } = req.body;

  if (!monto || monto < 10 || monto > 10000) {
    return res.status(400).json({ error: 'Amount must be between $10 and $10,000' });
  }

  try {
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      console.error(`User not found: ${req.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const userEmail = userResult.rows[0].email;
    console.log(`[Crypto Payment] User: ${req.userId}, Email: ${userEmail}, Amount: ${monto}`);

    const nowPaymentsUrl = 'https://api.nowpayments.io/v1/invoice';
    const options = {
      method: 'POST',
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY, 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: monto,
        price_currency: 'usd',
        order_id: req.userId,
        order_description: `Recarga de ${monto} USD en TokenForge`,
        success_url: `${process.env.FRONTEND_URL || 'https://tokenforge1-production.up.railway.app'}/dashboard.html`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://tokenforge1-production.up.railway.app'}/pricing.html`
      })
    };

    const npResponse = await fetch(nowPaymentsUrl, options);
    const data = await npResponse.json();

    if (npResponse.ok && data.invoice_url) {
      console.log(`[Crypto Payment] Success: returning NOWPayments URL for user ${req.userId}`);
      res.json({ paymentUrl: data.invoice_url });
    } else {
      console.error(`[Crypto Payment] NOWPayments Error:`, data);
      return res.status(502).json({ 
        error: 'Payment gateway error',
        details: 'Could not generate crypto invoice. Try again.'
      });
    }

  } catch (err) {
    console.error('[Crypto Payment] Unexpected error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to process payment request', details: err.message });
  }
});

module.exports = router;
