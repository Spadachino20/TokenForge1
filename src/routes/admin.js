const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getAllPricing, updateModelPricing } = require('../services/pricingService');
const { setProviderBalance, getAllProviderBalances, getLowBalanceProviders } = require('../services/providerBalanceService');
const db = require('../config/db');

const router = express.Router();

// Middleware para verificar admin
function requireAdmin(req, res, next) {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['stbenavente21@gmail.com'];

  db.query('SELECT email FROM users WHERE id = $1', [req.userId])
    .then(result => {
      if (result.rows.length === 0 || !adminEmails.includes(result.rows[0].email)) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    })
    .catch(err => {
      console.error('Admin check error:', err);
      res.status(500).json({ error: 'Failed to verify admin status' });
    });
}

// GET /admin/pricing
router.get('/pricing', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pricing = await getAllPricing();
    res.json(pricing);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// PATCH /admin/pricing/:model
router.patch('/pricing/:model', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await updateModelPricing(req.params.model, req.body);
    res.json({ message: `Pricing updated for ${req.params.model}`, cache: 'invalidated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// GET /admin/provider-balances
router.get('/provider-balances', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const balances = await getAllProviderBalances();
    const lowBalance = await getLowBalanceProviders();
    res.json({
      balances,
      low_balance_alerts: lowBalance,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/provider-balances
router.post('/provider-balances', authenticateToken, requireAdmin, async (req, res) => {
  const { provider, balance, notes } = req.body;

  if (!provider || !['openai', 'anthropic', 'gemini'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider. Use: openai, anthropic, gemini' });
  }

  if (typeof balance !== 'number' || balance < 0) {
    return res.status(400).json({ error: 'balance must be a positive number' });
  }

  try {
    await setProviderBalance(provider, balance, notes || null);
    res.json({
      success: true,
      message: `${provider} balance set to $${balance}`,
      provider,
      balance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;