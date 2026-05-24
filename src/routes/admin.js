const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getAllPricing, updateModelPricing } = require('../services/pricingService');

const router = express.Router();

// Middleware para verificar admin (simple: verificar email o lista de admins)
function requireAdmin(req, res, next) {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  
  // Necesitamos obtener el email del usuario desde la DB
  const db = require('../config/db');
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

// GET /admin/pricing - ver todos los precios actuales
router.get('/pricing', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pricing = await getAllPricing();
    res.json(pricing);
  } catch (err) {
    console.error('Get pricing error:', err);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// PATCH /admin/pricing/:model - actualizar precio sin redeploy
router.patch('/pricing/:model', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await updateModelPricing(req.params.model, req.body);
    res.json({ message: `Pricing updated for ${req.params.model}`, cache: 'invalidated' });
  } catch (err) {
    console.error('Update pricing error:', err);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

module.exports = router;
