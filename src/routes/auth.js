const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Register
router.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user.id, email: user.email, balance_tfc: 0 }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Valid email and password required' });
  }

  const { email, password } = req.body;

  try {
    const result = await db.query(
      'SELECT id, email, password_hash, balance_tfc FROM users WHERE email = $1',
      [email]
    );

    // Timing-safe: always run bcrypt even if user not found
    const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks.xxxxxxxxxxxxxxxxxx';
    const hashToCheck = result.rows.length > 0 ? result.rows[0].password_hash : dummyHash;
    const validPassword = await bcrypt.compare(password, hashToCheck);

    if (result.rows.length === 0 || !validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.json({
      token,
      user: { id: user.id, email: user.email, balance_tfc: parseFloat(user.balance_tfc) }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, balance_tfc, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get API keys
router.get('/keys', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, is_active, created_at, last_used_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ keys: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create API key
router.post('/keys', authenticateToken, async (req, res) => {
  const { name = 'Default Key', project_id } = req.body; // project_id es opcional; omitir → master key

  try {
    // Limit to 10 active keys per user
    const { rows } = await db.query(
      'SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = true',
      [req.userId]
    );
    if (parseInt(rows[0].count) >= 10) {
      return res.status(400).json({ error: 'Máximo de 10 keys activas permitido' });
    }

    // Generate key
    const keyValue = 'tf_sk_' + crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(keyValue).digest('hex');

    // Save to database (project_id optional: null = master key)
    const result = await db.query(
      `INSERT INTO api_keys (user_id, key_hash, name, project_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, is_active, created_at`,
      [req.userId, keyHash, name, project_id || null]
    );

    res.status(201).json({
      message: 'Key creada. ¡Guarda la clave ahora — no se mostrará nuevamente!',
      key: { ...result.rows[0], value: keyValue }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Revoke API key
router.delete('/keys/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Key not found' });
    res.json({ message: 'API key revoked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});
router.patch('/keys/:id', authenticateToken, async (req, res) => {
  const { action, name } = req.body;

  try {
    let result;

    if (action === 'rename' && name) {
      result = await db.query(
        'UPDATE api_keys SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, is_active, created_at',
        [name, req.params.id, req.userId]
      );
    } else if (action === 'revoke') {
      result = await db.query(
        'UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id, name, is_active, created_at',
        [req.params.id, req.userId]
      );
    } else if (action === 'reset') {
      const keyValue = 'tf_sk_' + crypto.randomBytes(32).toString('hex');
      const keyHash = crypto.createHash('sha256').update(keyValue).digest('hex');
      result = await db.query(
        'UPDATE api_keys SET key_hash = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, is_active, created_at',
        [keyHash, req.params.id, req.userId]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Key not found' });
      return res.json({ message: 'API key reset. Save it now.', key: { ...result.rows[0], value: keyValue } });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use: rename, revoke, or reset' });
    }

    if (result.rowCount === 0) return res.status(404).json({ error: 'Key not found' });
    res.json({ message: 'API key updated', key: result.rows[0] });

  } catch (err) {
    res.status(500).json({ error: 'Failed to update API key' });
  }
});
module.exports = router;
