const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Color palettes per provider
const COLORS = {
  anthropic: ['#FF6B00','#FF8C00','#FFA500','#FFB732','#FFCC66'],
  openai:    ['#00C48C','#00A572','#00875F','#34D399','#6EE7B7'],
  gemini:    ['#4285F4','#1A73E8','#0D47A1','#64B5F6','#90CAF9'],
};

function getColor(provider, index) {
  const palette = COLORS[provider] || ['#888'];
  return palette[index % palette.length];
}

router.get('/summary', authenticateToken, async (req, res) => {
  const { period = 'today', date, currency = 'usd' } = req.query;

  try {
    let timeFilter;
    if (period === 'today') {
      timeFilter = `created_at >= CURRENT_DATE`;
    } else if (period === 'yesterday') {
      timeFilter = `created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE`;
    } else if (period === 'date' && date) {
      timeFilter = `created_at >= '${date}'::date AND created_at < '${date}'::date + INTERVAL '1 day'`;
    } else {
      timeFilter = `created_at >= CURRENT_DATE`;
    }

    // Get usage grouped by hour and model
    const result = await db.query(`
      SELECT
        DATE_TRUNC('hour', created_at) AS hour,
        model,
        provider,
        SUM(cost_tfc) AS total_cost
      FROM usage_logs
      WHERE user_id = $1
        AND status IS DISTINCT FROM 'error'
        AND ${timeFilter}
      GROUP BY hour, model, provider
      ORDER BY hour ASC
    `, [req.userId]);

    if (result.rows.length === 0) {
      return res.json({ labels: [], datasets: [] });
    }

    // Build time labels
    const hoursSet = new Set(result.rows.map(r => r.hour));
    const hours = [...hoursSet].sort();
    const labels = hours.map(h => {
      const d = new Date(h);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    });

    // Group by model
    const modelMap = {};
    result.rows.forEach(row => {
      const key = row.model;
      if (!modelMap[key]) {
        modelMap[key] = { provider: row.provider, data: {} };
      }
      modelMap[key].data[row.hour] = parseFloat(row.total_cost);
    });

    // Build datasets
    const providerCount = {};
    const datasets = Object.entries(modelMap).map(([model, info]) => {
      const p = info.provider;
      providerCount[p] = (providerCount[p] || 0);
      const color = getColor(p, providerCount[p]);
      providerCount[p]++;

      const data = hours.map(h => {
        const val = info.data[h] || 0;
        // currency conversion: 1 TFC = 1 USD
        return parseFloat(val.toFixed(6));
      });

      return { model, provider: p, color, data };
    });

    res.json({ labels, datasets, currency });
  } catch (err) {
    console.error('Usage summary error:', err);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

module.exports = router;