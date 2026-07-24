const express = require('express');
const db = require('../config/db');
const { authenticateApiKey } = require('../middleware/auth');
const { apiKeyLimiter } = require('../middleware/rateLimit');
const { reserveBalance, settleBalance, releaseReservation } = require('../services/balanceService');
const { resolveModel, getLowBalanceProviders, settleProviderBalance } = require('../services/providerBalanceService');
const { sendLowBalanceAlert20, sendLowBalanceAlert10, sendEmail, sendAdminAlert } = require('../services/email');
const openai = require('../services/providers/openai');
const anthropic = require('../services/providers/anthropic');
const gemini = require('../services/providers/gemini');

const router = express.Router();

const AVAILABLE_MODELS = {
  'gpt-5.6-luna': 'openai',
  'gpt-5.6-terra': 'openai',
  'gpt-5.6-sol': 'openai',

  'claude-haiku-4-5-20251001': 'anthropic',
  'claude-sonnet-5': 'anthropic',
  'claude-opus-4-8': 'anthropic',

  'gemini-3.1-flash-lite': 'gemini',
  'gemini-3.5-flash': 'gemini',
  'gemini-3.1-pro-preview': 'gemini',
};
// List models
router.get('/models', async (req, res) => {
  res.json({
    object: 'list',
    data: Object.keys(AVAILABLE_MODELS).map(id => ({
      id,
      object: 'model',
      owned_by: AVAILABLE_MODELS[id]
    }))
  });
});

// Chat completions
router.post('/chat/completions', authenticateApiKey, apiKeyLimiter, async (req, res) => {
  const { model, messages, max_tokens, stream = true } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ 
      error: {
        code: 'missing_parameters',
        message: 'Model and messages are required'
      }
    });
  }

  const provider = AVAILABLE_MODELS[model];
  if (!provider) {
    return res.status(400).json({
      error: {
        code: 'model_not_available',
        message: `Model ${model} is not available. Use GET /v1/models to list available models.`
      }
    });
  }

  // Calculate conservative estimate based on model pricing
  const inputText = messages.map(m => m.content || '').join('');
  const estimatedInputTokens = Math.ceil(inputText.length / 3 * 1.2);
  const estimatedOutputTokens = max_tokens || 1000;
  const estimatedCost = Math.max(0.001, (estimatedInputTokens + estimatedOutputTokens) * 0.000002);

  // Estimado en USD para routing (ratio aproximado TFC/USD = 1.2 por el markup)
  const estimatedCostUsd = estimatedCost / 1.2;

  // Smart routing: resolver qué modelo/provider usar según balance disponible
  // estimatedCostUsd: aproximación burda para la decisión de routing (no es el costo final)
  const roughCostEstimateUsd = (estimatedCostUsd || 0.01);
  const resolved = await resolveModel(model, roughCostEstimateUsd);

  if (!resolved) {
    await sendAdminAlert('TokenForge: All providers low', 'All providers are currently unavailable due to low balance.');
    return res.status(503).json({
      error: {
        code: 'providers_unavailable',
        message: 'All providers are temporarily low on balance. Please try again in a moment.',
        retry_after: 60
      }
    });
  }

  const activeProvider = resolved.provider;
  const activeModel = resolved.model;

  // Si se redirigió, log para transparencia
  if (resolved.wasRerouted) {
    console.log(`[Routing] User requested ${model}, serving with ${activeModel}`);
    res.setHeader('X-TokenForge-Model-Used', activeModel);
    res.setHeader('X-TokenForge-Model-Requested', model);
    res.setHeader('X-TokenForge-Rerouted', 'true');
  } else {
    res.setHeader('X-TokenForge-Model-Used', activeModel);
  }

  // Block if balance insufficient
  const reservation = await reserveBalance(req.userId, estimatedCost);

  if (!reservation.success) {
    return res.status(402).json({
      error: {
        code: 'insufficient_balance',
        message: `Your balance (${reservation.currentBalance.toFixed(2)} TFC) is insufficient for this request (estimated ${reservation.required.toFixed(4)} TFC). Top up at ${process.env.FRONTEND_URL}/billing`,
        current_balance: reservation.currentBalance,
        estimated_cost: reservation.required
      }
    });
  }

  try {
    let result;

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const onChunk = (chunk) => {
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        res.write(data);
      };

      switch (activeProvider) {
        case 'openai':
          result = await openai.chatCompletion({ ...req.body, model: activeModel }, onChunk);
          break;
        case 'anthropic':
          result = await anthropic.chatCompletion({ ...req.body, model: activeModel }, onChunk);
          break;
        case 'gemini':
          result = await gemini.chatCompletion({ ...req.body, model: activeModel }, onChunk);
          break;
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      switch (activeProvider) {
        case 'openai':
          result = await openai.chatCompletion({ ...req.body, model: activeModel }, () => {});
          break;
        case 'anthropic':
          result = await anthropic.chatCompletion({ ...req.body, model: activeModel }, () => {});
          break;
        case 'gemini':
          result = await gemini.chatCompletion({ ...req.body, model: activeModel }, () => {});
          break;
      }

      res.json(result.response);
    }

    // Settle balance with actual cost
    await settleBalance(req.userId, estimatedCost, result.cost);

    // Ajuste de drift (Problema 1)
    const actualCostUsd = result.cost / 1.2;
    await settleProviderBalance(activeProvider, roughCostEstimateUsd, actualCostUsd).catch(() => {});

    // Log usage
    await db.query(
      'INSERT INTO usage_logs (user_id, api_key_id, model, provider, tokens_in, tokens_out, cost_tfc) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.userId, req.apiKeyId, activeModel, activeProvider, result.tokensIn, result.tokensOut, result.cost]
    );

    // Check balance alerts (20% and 10%)
    const balanceResult = await db.query(
      'SELECT balance_tfc FROM users WHERE id = $1',
      [req.userId]
    );
    const currentBalance = parseFloat(balanceResult.rows[0].balance_tfc);
    const initialBalance = currentBalance + result.cost;
    const percentRemaining = (currentBalance / initialBalance) * 100;

    if (percentRemaining <= 10) {
      const notif10 = await db.query(
        `INSERT INTO notifications (user_id, type, sent_at)
         VALUES ($1, 'balance_10', NOW())
         ON CONFLICT (user_id, type) DO NOTHING
         RETURNING id`,
        [req.userId]
      );
      if (notif10.rows.length > 0) {
        const userEmail = await db.query('SELECT email FROM users WHERE id = $1', [req.userId]);
        await sendLowBalanceAlert10(userEmail.rows[0].email, currentBalance);
      }
    } else if (percentRemaining <= 20) {
      const notif20 = await db.query(
        `INSERT INTO notifications (user_id, type, sent_at)
         VALUES ($1, 'balance_20', NOW())
         ON CONFLICT (user_id, type) DO NOTHING
         RETURNING id`,
        [req.userId]
      );
      if (notif20.rows.length > 0) {
        const userEmail = await db.query('SELECT email FROM users WHERE id = $1', [req.userId]);
        await sendLowBalanceAlert20(userEmail.rows[0].email, currentBalance);
      }
    }

  } catch (err) {
    console.error('API error:', err);
    await releaseReservation(req.userId, estimatedCost);

    await db.query(
      'INSERT INTO usage_logs (user_id, api_key_id, model, provider, cost_tfc, status, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.userId, req.apiKeyId, model, provider, 0, 'error', err.message]
    );

    if (!res.headersSent) {
      res.status(500).json({ 
        error: {
          code: 'provider_error',
          message: err.message
        }
      });
    }
  }
});

module.exports = router;