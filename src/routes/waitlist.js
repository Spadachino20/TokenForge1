const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { generalLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Add to waitlist
router.post('/waitlist', generalLimiter, [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    await db.query(
      'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email]
    );
    res.status(201).json({ message: 'Added to waitlist' });
  } catch (err) {
    console.error('Waitlist error:', err);
    res.status(500).json({ error: 'Failed to add to waitlist' });
  }
});

module.exports = router;
