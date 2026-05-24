const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    next();
  });
}

async function authenticateApiKey(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = authHeader && authHeader.split(' ')[1];

  if (!apiKey || !apiKey.startsWith('tf_sk_')) {
    return res.status(401).json({ error: 'Valid API key required (tf_sk_...)' });
  }

  try {
    // Hash the received key for comparison
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const result = await db.query(
      'SELECT ak.*, u.balance_tfc FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key_hash = $1 AND ak.is_active = true',
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    const keyData = result.rows[0];
    req.userId = keyData.user_id;
    req.apiKeyId = keyData.id;
    req.userBalance = parseFloat(keyData.balance_tfc);
    req.apiKey = apiKey;

    // Update last used
    await db.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [keyData.id]);

    next();
  } catch (err) {
    console.error('API key auth error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = {
  generateToken,
  authenticateToken,
  authenticateApiKey
};
