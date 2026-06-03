const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Crear proyecto
router.post('/', authenticateToken, async (req, res) => {
  const { name, description, budget_tfc, budget_period, allowed_models } = req.body;

  try {
   const result = await db.query(`
      INSERT INTO projects (user_id, name, monthly_budget_tfc)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.userId, name, req.body.monthly_budget_tfc || 0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Listar proyectos del usuario
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Stats de un proyecto
router.get('/:projectId/stats', authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const [project, stats, byModel, dailyUsage] = await Promise.all([
      db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, req.userId]),
      db.query(`
        SELECT
          COUNT(*) as total_requests,
          SUM(cost_tfc) as total_cost_tfc,
          SUM(tokens_in + tokens_out) as total_tokens,
          COUNT(DISTINCT api_key_id) as active_keys
        FROM usage_logs
        WHERE project_id = $1 AND status = 'success'
      `, [projectId]),
      db.query(`
        SELECT
          model,
          provider,
          COUNT(*) as requests,
          SUM(cost_tfc) as cost_tfc,
          SUM(tokens_in) as tokens_in,
          SUM(tokens_out) as tokens_out
        FROM usage_logs
        WHERE project_id = $1 AND status = 'success'
        AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY model, provider
        ORDER BY cost_tfc DESC
      `, [projectId]),
      db.query(`
        SELECT
          DATE(created_at) as date,
          SUM(cost_tfc) as daily_cost,
          COUNT(*) as requests
        FROM usage_logs
        WHERE project_id = $1 AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [projectId])
    ]);

    if (!project.rows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      project: project.rows[0],
      stats: stats.rows[0],
      byModel: byModel.rows,
      dailyUsage: dailyUsage.rows
    });
  } catch (err) {
    console.error('Project stats error:', err);
    res.status(500).json({ error: 'Failed to fetch project stats' });
  }
});

// Generar API key para un proyecto
router.post('/:projectId/keys', authenticateToken, async (req, res) => {
  const { name, expires_at, monthly_spend_limit_tfc } = req.body;

  try {
    // Verificar que el proyecto es del usuario
    const project = await db.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.projectId, req.userId]
    );
    if (!project.rows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Generar key
    const rawKey = `tf_sk_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = rawKey.substring(0, 12);
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await db.query(`
      INSERT INTO api_keys (user_id, project_id, key_hash, key_prefix, name, expires_at, monthly_spend_limit_tfc)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [req.userId, req.params.projectId, hash, prefix, name, expires_at, monthly_spend_limit_tfc]);

    res.status(201).json({
      key: rawKey,
      prefix,
      name,
      warning: 'Save this key now. You will not be able to see it again.'
    });
  } catch (err) {
    console.error('Create project key error:', err);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

  // Update project budget/name
  router.patch('/:projectId', authenticateToken, async (req, res) => {
    const { projectId } = req.params;
    const { monthly_budget_tfc, name } = req.body; // Match frontend parameter names

    try {
      // Update project (allow optional name/budget updates)
      const result = await db.query(`
        UPDATE projects
        SET name = COALESCE($2, name), monthly_budget_tfc = COALESCE($3, monthly_budget_tfc)
        WHERE id = $1 AND user_id = $4
      `, [projectId, name, monthly_budget_tfc, req.userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Project not found or unauthorized' });
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update project error:', err);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  // Delete project
  router.delete('/:projectId', authenticateToken, async (req, res) => {
    const { projectId } = req.params;

    try {
      const result = await db.query(
        'DELETE FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, req.userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Project not found or unauthorized' });
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete project error:', err);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

module.exports = router;
