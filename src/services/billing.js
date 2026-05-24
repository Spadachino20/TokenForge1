const db = require('../config/db');

/**
 * Deduct TFC from user balance atomically
 * Prevents race conditions by doing the check and update in one query
 * 
 * @param {string} userId - User UUID
 * @param {number} amount - Amount to deduct
 * @returns {Promise<Object>} - { success: boolean, newBalance: number|null, error: string|null }
 */
async function deductBalance(userId, amount) {
  try {
    const result = await db.query(
      `UPDATE users 
       SET balance_tfc = balance_tfc - $1 
       WHERE id = $2 AND balance_tfc >= $1 
       RETURNING balance_tfc`,
      [amount, userId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        newBalance: null,
        error: 'Insufficient balance'
      };
    }

    return {
      success: true,
      newBalance: parseFloat(result.rows[0].balance_tfc),
      error: null
    };
  } catch (err) {
    console.error('Deduct balance error:', err);
    return {
      success: false,
      newBalance: null,
      error: 'Failed to process payment'
    };
  }
}

/**
 * Estimate cost before processing request
 * Uses conservative estimate (content.length / 3 * 1.2 buffer)
 * 
 * @param {string} model - Model name
 * @param {Array} messages - OpenAI format messages
 * @returns {number} - Estimated cost in TFC
 */
function estimateCost(model, messages) {
  const totalChars = messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0);
  const estimatedTokens = Math.ceil(totalChars / 3) * 1.2; // Conservative estimate with 20% buffer
  
  // Rough pricing estimate (will be refined by actual provider)
  const avgCostPer1k = 0.005; // Average across models
  return (estimatedTokens / 1000) * avgCostPer1k * 1.15; // Include markup
}

module.exports = {
  deductBalance,
  estimateCost
};
