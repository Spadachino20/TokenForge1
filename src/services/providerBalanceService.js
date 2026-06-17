const { pool } = require('../config/db');

// Mapa de modelos equivalentes por tier
const MODEL_EQUIVALENTS = {
  // Tier CHEAP (fast, low cost)
  'gpt-4o-mini':        { tier: 'cheap',  alternatives: ['claude-haiku-4-5', 'gemini-2.0-flash-lite'] },
  'gpt-3.5-turbo':      { tier: 'cheap',  alternatives: ['claude-haiku-4-5', 'gemini-2.0-flash-lite'] },
  'claude-haiku-4-5':   { tier: 'cheap',  alternatives: ['gpt-4o-mini', 'gemini-2.0-flash-lite'] },
  'claude-3-haiku-20240307': { tier: 'cheap', alternatives: ['gpt-4o-mini', 'gemini-2.0-flash-lite'] },
  'gemini-2.0-flash-lite': { tier: 'cheap', alternatives: ['gpt-4o-mini', 'claude-haiku-4-5'] },

  // Tier MID (balanced)
  'gpt-4o':             { tier: 'mid',    alternatives: ['claude-sonnet-4-6', 'gemini-2.5-flash'] },
  'gpt-4-turbo':        { tier: 'mid',    alternatives: ['claude-sonnet-4-6', 'gemini-2.5-flash'] },
  'claude-sonnet-4-6':  { tier: 'mid',    alternatives: ['gpt-4o', 'gemini-2.5-flash'] },
  'claude-3-sonnet-20240229': { tier: 'mid', alternatives: ['gpt-4o', 'gemini-2.5-flash'] },
  'gemini-2.5-flash':   { tier: 'mid',    alternatives: ['gpt-4o', 'claude-sonnet-4-6'] },
  'gemini-2.0-flash':   { tier: 'mid',    alternatives: ['gpt-4o', 'claude-sonnet-4-6'] },

  // Tier HIGH (most capable)
  'gpt-5.5':            { tier: 'high',   alternatives: ['claude-opus-4-8', 'gemini-2.5-pro'] },
  'claude-opus-4-8':    { tier: 'high',   alternatives: ['gpt-5.5', 'gemini-2.5-pro'] },
  'claude-3-opus-20240229': { tier: 'high', alternatives: ['gpt-5.5', 'gemini-2.5-pro'] },
  'gemini-2.5-pro':     { tier: 'high',   alternatives: ['gpt-5.5', 'claude-opus-4-8'] },
};

// Mapa modelo → provider
const MODEL_PROVIDER = {
  'gpt-5.5': 'openai', 'gpt-4o': 'openai', 'gpt-4o-mini': 'openai',
  'gpt-4-turbo': 'openai', 'gpt-3.5-turbo': 'openai',
  'claude-opus-4-8': 'anthropic', 'claude-sonnet-4-6': 'anthropic',
  'claude-haiku-4-5': 'anthropic', 'claude-3-opus-20240229': 'anthropic',
  'claude-3-sonnet-20240229': 'anthropic', 'claude-3-haiku-20240307': 'anthropic',
  'gemini-2.5-pro': 'gemini', 'gemini-2.5-flash': 'gemini',
  'gemini-2.0-flash': 'gemini', 'gemini-2.0-flash-lite': 'gemini',
};

/**
 * Obtiene todos los balances de providers desde la DB
 */
async function getAllProviderBalances() {
  try {
    const result = await pool.query(
      'SELECT provider, estimated_balance_usd, low_balance_threshold_usd FROM provider_balances'
    );
    const balances = {};
    for (const row of result.rows) {
      const balance = parseFloat(row.estimated_balance_usd);
      balances[row.provider] = {
        balance: balance,
        threshold: parseFloat(row.low_balance_threshold_usd),
        is_configured: balance !== -1
      };
    }
    return balances;
  } catch (err) {
    console.error('[ProviderBalance] Failed to fetch balances:', err.message);
    return null; // fail-open
  }
}

/**
 * Determina qué modelo usar para un request, según balances actuales.
 */
async function resolveModel(requestedModel, estimatedCostUsd) {
  const balances = await getAllProviderBalances();

  // Si no pudimos leer balances (DB error), fail-open
  if (!balances) {
    const provider = MODEL_PROVIDER[requestedModel];
    return { model: requestedModel, provider, wasRerouted: false };
  }

  const requestedProvider = MODEL_PROVIDER[requestedModel];
  if (!requestedProvider) return null;

  const MIN_BUFFER = 2.00;
  const costWithBuffer = estimatedCostUsd + MIN_BUFFER;

  // Intentar deducir saldo atómicamente
  // BUG 1 Fix: Atomic deduction using UPDATE...RETURNING
  // BUG 2 Fix: Skip check if balance is -1
  const balanceInfo = balances[requestedProvider];
  if (balanceInfo && !balanceInfo.is_configured) {
    return { model: requestedModel, provider: requestedProvider, wasRerouted: false };
  }

  try {
    const res = await pool.query(
      `UPDATE provider_balances
       SET estimated_balance_usd = estimated_balance_usd - $1
       WHERE provider = $2 AND estimated_balance_usd >= $3
       RETURNING estimated_balance_usd`,
      [estimatedCostUsd, requestedProvider, costWithBuffer]
    );

    if (res.rowCount > 0) {
      return { model: requestedModel, provider: requestedProvider, wasRerouted: false };
    }
  } catch (err) {
    console.error(`[ProviderBalance] Atomic deduction failed for ${requestedProvider}:`, err.message);
    // Fail-open
    return { model: requestedModel, provider: requestedProvider, wasRerouted: false };
  }

  // Si falló, intentar alternativas (BUG 1)
  const equivalents = MODEL_EQUIVALENTS[requestedModel];
  if (equivalents) {
    for (const altModel of equivalents.alternatives) {
      const altProvider = MODEL_PROVIDER[altModel];
      if (!altProvider) continue;

      const altBalanceInfo = balances[altProvider];
      if (altBalanceInfo && !altBalanceInfo.is_configured) {
          return { model: altModel, provider: altProvider, wasRerouted: true };
      }

      try {
        const res = await pool.query(
          `UPDATE provider_balances
           SET estimated_balance_usd = estimated_balance_usd - $1
           WHERE provider = $2 AND estimated_balance_usd >= $3
           RETURNING estimated_balance_usd`,
          [estimatedCostUsd, altProvider, costWithBuffer]
        );

        if (res.rowCount > 0) {
          console.log(`[ProviderBalance] Rerouted to ${altModel}`);
          return { model: altModel, provider: altProvider, wasRerouted: true };
        }
      } catch (err) {
        console.error(`[ProviderBalance] Alt deduction failed:`, err.message);
      }
    }
  }

  return null;
}

/**
 * Descuenta el costo real de un request del balance estimado del provider.
 */
async function deductFromProviderBalance(provider, costUsd) {
  try {
    await pool.query(
      `UPDATE provider_balances
       SET estimated_balance_usd = GREATEST(0, estimated_balance_usd - $1),
           last_updated_at = NOW()
       WHERE provider = $2`,
      [costUsd, provider]
    );
  } catch (err) {
    console.error(`[ProviderBalance] Failed to deduct ${costUsd} from ${provider}:`, err.message);
  }
}

/**
 * Actualiza el balance de un provider manualmente (cuando tú recargas).
 */
async function setProviderBalance(provider, newBalanceUsd, notes = null) {
  await pool.query(
    `UPDATE provider_balances
     SET estimated_balance_usd = $1,
         last_recharge_at = NOW(),
         last_updated_at = NOW(),
         notes = COALESCE($2, notes)
     WHERE provider = $3`,
    [newBalanceUsd, notes, provider]
  );
}

/**
 * Retorna los providers con balance bajo (por debajo de su threshold).
 */
async function getLowBalanceProviders() {
  try {
    const result = await pool.query(
      `SELECT provider, estimated_balance_usd, low_balance_threshold_usd
       FROM provider_balances
       WHERE estimated_balance_usd < low_balance_threshold_usd`
    );
    return result.rows;
  } catch (err) {
    return [];
  }
}

/**
 * Ajusta el balance estimado con la diferencia entre el costo real y el estimado inicial.
 * Si el costo real fue menor, devuelve saldo al provider.
 */
async function settleProviderBalance(provider, roughEstimateUsd, actualCostUsd) {
  try {
    const diff = actualCostUsd - roughEstimateUsd;
    await pool.query(
      `UPDATE provider_balances
       SET estimated_balance_usd = estimated_balance_usd - $1,
           last_updated_at = NOW()
       WHERE provider = $2`,
      [diff, provider]
    );
  } catch (err) {
    console.error(`[ProviderBalance] Failed to settle balance for ${provider}:`, err.message);
  }
}

module.exports = {
  resolveModel,
  deductFromProviderBalance,
  setProviderBalance,
  getLowBalanceProviders,
  getAllProviderBalances,
  settleProviderBalance
};