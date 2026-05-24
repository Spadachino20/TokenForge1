const express = require('express');
const db = require('../config/db');
const { authenticateApiKey } = require('../middleware/auth');
const { apiKeyLimiter } = require('../middleware/rateLimit');
const { reserveBalance, settleBalance, releaseReservation } = require('../services/balanceService');
const openai = require('../services/providers/openai');
const anthropic = require('../services/providers/anthropic');
const gemini = require('../services/providers/gemini');

const router = express.Router();

// Models available
const AVAILABLE_MODELS = {
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-3.5-turbo': 'openai',
  'claude-3-sonnet-20240229': 'anthropic',
  'claude-3-opus-20240229': 'anthropic',
  'claude-3-haiku-20240307': 'anthropic',
  'gemini-1.5-pro': 'gemini',
  'gemini-1.5-flash': 'gemini'
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
  const estimatedInputTokens = Math.ceil(inputText.length / 3 * 1.2); // conservative
  const estimatedOutputTokens = max_tokens || 1000;
  // Estimate: ~$0.002 per 1k tokens for cheapest model, * output estimate
  const estimatedCost = Math.max(0.001, (estimatedInputTokens + estimatedOutputTokens) * 0.000002);

  // Reserve balance atomically
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

      switch (provider) {
        case 'openai':
          result = await openai.chatCompletion(req.body, onChunk);
          break;
        case 'anthropic':
          result = await anthropic.chatCompletion(req.body, onChunk);
          break;
        case 'gemini':
          result = await gemini.chatCompletion(req.body, onChunk);
          break;
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      switch (provider) {
        case 'openai':
          result = await openai.chatCompletion(req.body, () => {});
          break;
        case 'anthropic':
          result = await anthropic.chatCompletion(req.body, () => {});
          break;
        case 'gemini':
          result = await gemini.chatCompletion(req.body, () => {});
          break;
      }

      res.json(result.response);
    }

    // Settle balance (adjust for actual cost)
    await settleBalance(req.userId, estimatedCost, result.cost);

    // Log usage
    await db.query(
      'INSERT INTO usage_logs (user_id, api_key_id, model, provider, tokens_in, tokens_out, cost_tfc) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.userId, req.apiKeyId, model, provider, result.tokensIn, result.tokensOut, result.cost]
    );

    // Set usage headers
    res.setHeader('X-TFC-Cost-This-Request', result.cost.toFixed(6));
    res.setHeader('X-TFC-Balance-Remaining', (reservation.balanceAfterReservation + estimatedCost - result.cost).toFixed(4));

  } catch (err) {
    console.error('API error:', err);

    // Release reservation on error
    await releaseReservation(req.userId, estimatedCost);

    // Log failed usage
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
