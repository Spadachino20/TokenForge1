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
        order_id: req.userId, // AQUÍ ENVIAMOS EL ID DEL USUARIO A NOWPAYMENTS
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

// ==================== WEBHOOK DE NOWPAYMENTS ====================
// IMPORTANTE: Este endpoint NO lleva "authenticateToken" porque es llamado automáticamente por los servidores de NOWPayments, no por el usuario.
router.post('/webhook', async (req, res) => {
  try {
    const { payment_status, order_id, price_amount } = req.body;
    console.log(`[Webhook NOWPayments] Recibido. Estado: ${payment_status} | Usuario ID: ${order_id}`);

    // Si el estado es "finished", el dinero ya está confirmado en la blockchain
    if (payment_status === 'finished') {
      const creditsToAdd = parseFloat(price_amount);

      // Usamos BEGIN y COMMIT para asegurar que ambas consultas (update e insert) se ejecuten correctamente juntas
      await db.query('BEGIN');

      try {
        // 1. Sumar el saldo en la tabla users
        await db.query(
          'UPDATE users SET balance_tfc = balance_tfc + $1 WHERE id = $2',
          [creditsToAdd, order_id]
        );

        // 2. Registrar el depósito en la tabla transactions
        await db.query(
          `INSERT INTO transactions (user_id, type, amount_tfc, description) 
           VALUES ($1, 'deposit', $2, 'Recarga Crypto vía NOWPayments')`,
          [order_id, creditsToAdd]
        );

        // Si todo salió bien, guardamos los cambios en la base de datos
        await db.query('COMMIT');
        console.log(`🎉 [Webhook] Éxito: Se sumaron ${creditsToAdd} TFC al usuario ${order_id}`);
        
        // (Opcional) Si quieres enviar un correo al cliente de que su recarga fue exitosa:
        // const userEmailQuery = await db.query('SELECT email FROM users WHERE id = $1', [order_id]);
        // if(userEmailQuery.rows[0]) sendPurchaseConfirmation(userEmailQuery.rows[0].email, creditsToAdd);

      } catch (dbError) {
        // Si hay un error en las consultas, revertimos los cambios por seguridad
        await db.query('ROLLBACK');
        console.error('[Webhook] Error en la base de datos, transacción revertida:', dbError);
        throw dbError; // Enviamos el error al bloque catch principal
      }
    }

    // Siempre debemos responder con estado 200 a NOWPayments, sino intentarán reenviar el webhook muchas veces
    res.status(200).send('OK');

  } catch (err) {
    console.error('[Webhook] Error crítico procesando la notificación:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;