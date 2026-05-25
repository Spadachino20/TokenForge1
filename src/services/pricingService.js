const { pool } = require('../config/db');

// Simple in-memory cache (no Redis dependency for Railway)
let pricingCache = null;
let cacheExpiry = 0;
const CACHE_TTL = 300000; // 5 minutos en ms

async function getAllPricing() {
  // 1. Intentar desde cache en memoria
  const now = Date.now();
  if (pricingCache && cacheExpiry > now) {
    return pricingCache;
  }

  // 2. Si no hay cache, ir a DB
  const result = await pool.query(`
    SELECT
      model, provider, display_name,
      input_cost_per_1k,
      output_cost_per_1k,
      context_window, max_output_tokens,
      markup_multiplier
    FROM model_pricing
    WHERE is_active = true
    ORDER BY provider, model
  `);

  // Convertir a mapa para lookup O(1)
  const pricingMap = {};
  for (const row of result.rows) {
    pricingMap[row.model] = {
      provider: row.provider,
      displayName: row.display_name,
      inputCostPerToken: parseFloat(row.input_cost_per_1k),
      outputCostPerToken: parseFloat(row.output_cost_per_1k),
      contextWindow: row.context_window,
      maxOutputTokens: row.max_output_tokens,
      markup: parseFloat(row.markup_multiplier)
    };
  }

  // 3. Guardar en cache
  pricingCache = pricingMap;
  cacheExpiry = now + CACHE_TTL;

  return pricingMap;
}

async function calculateCost(model, inputTokens, outputTokens) {
  const pricing = await getAllPricing();
  const modelPricing = pricing[model];

  if (!modelPricing) {
    throw new Error(`Model '${model}' not found or not supported`);
  }

  const inputCost = inputTokens * modelPricing.inputCostPerToken;
  const outputCost = outputTokens * modelPricing.outputCostPerToken;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    provider: modelPricing.provider
  };
}

// Llamar esto cuando se actualiza pricing en DB
async function invalidatePricingCache() {
  pricingCache = null;
  cacheExpiry = 0;
  console.log('Pricing cache invalidated');
}

// Endpoint admin para actualizar pricing sin redeploy
async function updateModelPricing(model, updates) {
  const { input_cost_per_1k, output_cost_per_1k, markup_multiplier } = updates;

  await pool.query(`
    UPDATE model_pricing
    SET
      input_cost_per_1k = COALESCE($1, input_cost_per_1k),
      output_cost_per_1k = COALESCE($2, output_cost_per_1k),
      markup_multiplier = COALESCE($3, markup_multiplier),
      notes = COALESCE($4, notes),
      updated_at = NOW()
    WHERE model = $5
  `, [input_cost_per_1k, output_cost_per_1k, markup_multiplier, updates.notes, model]);

  await invalidatePricingCache();
}

module.exports = { getAllPricing, calculateCost, updateModelPricing, invalidatePricingCache };
