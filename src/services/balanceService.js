const { pool } = require('../config/db');

/**
 * Reserva saldo antes de la request al proveedor.
 * Atómico - no hay race condition posible.
 */
async function reserveBalance(userId, estimatedCost) {
  const result = await pool.query(`
    UPDATE users
    SET
      balance_tfc = balance_tfc - $1,
      reserved_tfc = COALESCE(reserved_tfc, 0) + $1
    WHERE
      id = $2
      AND balance_tfc >= $1
    RETURNING balance_tfc, reserved_tfc
  `, [estimatedCost, userId]);

  if (result.rowCount === 0) {
    // No se actualizó ninguna fila = saldo insuficiente
    const current = await pool.query(
      'SELECT balance_tfc FROM users WHERE id = $1', [userId]
    );
    return {
      success: false,
      currentBalance: current.rows[0]?.balance_tfc ?? 0,
      required: estimatedCost
    };
  }

  return {
    success: true,
    balanceAfterReservation: result.rows[0].balance_tfc
  };
}

/**
 * Ajusta al costo real después de que el proveedor responde.
 * Si el real < estimado, devuelve la diferencia.
 */
async function settleBalance(userId, estimatedCost, actualCost, client = pool) {
  const difference = estimatedCost - actualCost; // positivo = devolver, negativo = cobrar más

  await client.query(`
    UPDATE users
    SET
      balance_tfc = balance_tfc + $1,
      reserved_tfc = COALESCE(reserved_tfc, 0) - $2
    WHERE id = $3
  `, [difference, estimatedCost, userId]);
}

/**
 * Si la request al proveedor falla, libera la reserva completa.
 */
async function releaseReservation(userId, reservedAmount, client = pool) {
  await client.query(`
    UPDATE users
    SET
      balance_tfc = balance_tfc + $1,
      reserved_tfc = COALESCE(reserved_tfc, 0) - $1
    WHERE id = $2
  `, [reservedAmount, userId]);
}

module.exports = { reserveBalance, settleBalance, releaseReservation };
