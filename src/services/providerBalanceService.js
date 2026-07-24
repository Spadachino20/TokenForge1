const { pool } = require('../config/db');

// --- TIERS Y ALTERNATIVAS 2026 ---
const MODEL_EQUIVALENTS = {
  'gpt-5.6-luna':                { tier: 'budget',   alternatives: ['claude-haiku-4-5-20251001', 'gemini-3.1-flash-lite'] },
  'claude-haiku-4-5-20251001':   { tier: 'budget',   alternatives: ['gpt-5.6-luna', 'gemini-3.1-flash-lite'] },
  'gemini-3.1-flash-lite':       { tier: 'budget',   alternatives: ['gpt-5.6-luna', 'claude-haiku-4-5-20251001'] },

  'gpt-5.6-terra':               { tier: 'balanced', alternatives: ['claude-sonnet-5', 'gemini-3.5-flash'] },
  'claude-sonnet-5':             { tier: 'balanced', alternatives: ['gpt-5.6-terra', 'gemini-3.5-flash'] },
  'gemini-3.5-flash':            { tier: 'balanced', alternatives: ['gpt-5.6-terra', 'claude-sonnet-5'] },

  'gpt-5.6-sol':                 { tier: 'flagship', alternatives: ['claude-opus-4-8', 'gemini-3.1-pro-preview'] },
  'claude-opus-4-8':             { tier: 'flagship', alternatives: ['gpt-5.6-sol', 'gemini-3.1-pro-preview'] },
  'gemini-3.1-pro-preview':      { tier: 'flagship', alternatives: ['gpt-5.6-sol', 'claude-opus-4-8'] }
};

const MODEL_PROVIDER = {
  'gpt-5.6-luna': 'openai', 'gpt-5.6-terra': 'openai', 'gpt-5.6-sol': 'openai',
  'claude-haiku-4-5-20251001': 'anthropic', 'claude-sonnet-5': 'anthropic', 'claude-opus-4-8': 'anthropic',
  'gemini-3.1-flash-lite': 'gemini', 'gemini-3.5-flash': 'gemini', 'gemini-3.1-pro-preview': 'gemini'
};

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
    return null;
  }
}

async function resolveModel(requestedModel, estimatedCostUsd) {
  const balances = await getAllProviderBalances();

  if (!balances) {
    const provider = MODEL_PROVIDER[requestedModel];
    return { model: requestedModel, provider, wasRerouted: false };
  }

  const requestedProvider = MODEL_PROVIDER[requestedModel];
  if (!requestedProvider) return null;

  const MIN_BUFFER = 2.00;
  const costWithBuffer = estimatedCostUsd + MIN_BUFFER;

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
    return { model: requestedModel, provider: requestedProvider, wasRerouted: false };
  }

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

async function settleProviderBalance(provider, roughEstimateUsd, actualCostUsd) {
  try {
    // CORRECCIÓN: Si el costo real es menor al estimado, devolvemos dinero al balance.
    // Ej: estimado 0.10, real 0.08 -> diff = -0.02. 
    // SQL: estimado - (-0.02) = estimado + 0.02. ¡Ahora sí cuadra!
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

async function setProviderBalance(provider, newBalanceUsd, notes = null) {
  try {
    await pool.query(
      `UPDATE provider_balances
       SET estimated_balance_usd = $1,
           last_recharge_at = NOW(),
           last_updated_at = NOW(),
           notes = COALESCE($2, notes)
       WHERE provider = $3`,
      [newBalanceUsd, notes, provider]
    );
  } catch (err) {
    console.error(`[ProviderBalance] Failed to set balance for ${provider}:`, err.message);
  }
}

async function getLowBalanceProviders() {
  try {
    const result = await pool.query(
      `SELECT provider, estimated_balance_usd, low_balance_threshold_usd
       FROM provider_balances
       WHERE estimated_balance_usd < low_balance_threshold_usd`
    );
    return result.rows;
  } catch (err) {
    console.error(`[ProviderBalance] Failed to fetch low balance providers:`, err.message);
    return [];
  }
}

module.exports = {
  resolveModel,
  setProviderBalance,
  getLowBalanceProviders,
  getAllProviderBalances,
  settleProviderBalance
};