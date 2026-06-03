const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const { name, monthly_budget_tfc } = req.body;
  const budget = parseFloat(monthly_budget_tfc) || 0;
  try {
    const result = await db.query(
      'INSERT INTO projects (user_id, name, monthly_budget_tfc) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, name, budget]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

router.patch('/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const { monthly_budget_tfc, name } = req.body;
  try {
    const result = await db.query(
      'UPDATE projects SET name = COALESCE($2, name), monthly_budget_tfc = COALESCE($3, monthly_budget_tfc) WHERE id = $1 AND user_id = $4',
      [projectId, name, monthly_budget_tfc, req.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;