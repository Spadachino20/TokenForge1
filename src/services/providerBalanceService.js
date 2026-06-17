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
      balances[row.provider] = {
        balance: parseFloat(row.estimated_balance_usd),
        threshold: parseFloat(row.low_balance_threshold_usd)
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

  // Si no pudimos leer balances (DB error), fail-open: usar el modelo solicitado
  if (!balances) {
    const provider = MODEL_PROVIDER[requestedModel];
    return { model: requestedModel, provider, wasRerouted: false };
  }

  const requestedProvider = MODEL_PROVIDER[requestedModel];
  if (!requestedProvider) return null;

  const providerBalance = balances[requestedProvider];
  const MIN_BUFFER = 2.00; // $2 de buffer mínimo sobre el costo del request

  // El provider tiene suficiente balance
  if (providerBalance && providerBalance.balance >= (estimatedCostUsd + MIN_BUFFER)) {
    return { model: requestedModel, provider: requestedProvider, wasRerouted: false };
  }

  // El provider está bajo — buscar alternativas
  const equivalents = MODEL_EQUIVALENTS[requestedModel];
  if (!equivalents) {
    return null;
  }

  for (const altModel of equivalents.alternatives) {
    const altProvider = MODEL_PROVIDER[altModel];
    if (!altProvider) continue;

    const altBalance = balances[altProvider];
    if (altBalance && altBalance.balance >= (estimatedCostUsd + MIN_BUFFER)) {
      console.log(`[ProviderBalance] Rerouting ${requestedModel} (${requestedProvider}) → ${altModel} (${altProvider}). Reason: ${requestedProvider} balance=${providerBalance?.balance?.toFixed(2) || 'unknown'}`);
      return { model: altModel, provider: altProvider, wasRerouted: true };
    }
  }

  // Ningún provider tiene suficiente balance
  console.error(`[ProviderBalance] All providers low for tier ${equivalents.tier}. Balances: ${JSON.stringify(Object.fromEntries(Object.entries(balances).map(([k,v]) => [k, v.balance])))}`);
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

module.exports = {
  resolveModel,
  deductFromProviderBalance,
  setProviderBalance,
  getLowBalanceProviders,
  getAllProviderBalances
};