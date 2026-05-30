const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Alert at 20% balance remaining
async function sendLowBalanceAlert20(email, balance) {
  try {
    await resend.emails.send({
      from: 'TokenForge <alerts@tokenforge.ai>',
      to: email,
      subject: '⚠️ Your TokenForge balance is at 20%',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#00d4ff">⚠️ Balance Alert — 20% Remaining</h2>
          <p>Your TokenForge balance is running low.</p>
          <p>Current balance: <strong>${balance.toFixed(4)} TFC ($${balance.toFixed(2)} USD)</strong></p>
          <p>Add credits to keep your requests running without interruption.</p>
          <a href="${process.env.FRONTEND_URL}" 
             style="display:inline-block;background:#00d4ff;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">
            Add TFC Credits
          </a>
          <p style="color:#888;font-size:0.85rem;margin-top:24px">
            You'll receive one more alert when your balance reaches 10%.
          </p>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send 20% balance alert:', err);
  }
}

// Alert at 10% balance remaining
async function sendLowBalanceAlert10(email, balance) {
  try {
    await resend.emails.send({
      from: 'TokenForge <alerts@tokenforge.ai>',
      to: email,
      subject: '🔴 Your TokenForge balance is at 10% — Add credits now',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#ef4444">🔴 Balance Alert — 10% Remaining</h2>
          <p>Your TokenForge balance is critically low.</p>
          <p>Current balance: <strong>${balance.toFixed(4)} TFC ($${balance.toFixed(2)} USD)</strong></p>
          <p>Your requests will be blocked when your balance reaches 0. Add credits now to avoid interruption.</p>
          <a href="${process.env.FRONTEND_URL}" 
             style="display:inline-block;background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">
            Add TFC Credits Now
          </a>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send 10% balance alert:', err);
  }
}

// Alert when project reaches 20% of its budget
async function sendProjectBudgetAlert(email, projectName, remaining, total) {
  try {
    const percent = Math.round((remaining / total) * 100);
    await resend.emails.send({
      from: 'TokenForge <alerts@tokenforge.ai>',
      to: email,
      subject: `⚠️ Project "${projectName}" budget at ${percent}%`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#f59e0b">⚠️ Project Budget Alert</h2>
          <p>Your project <strong>"${projectName}"</strong> is running low on budget.</p>
          <p>Remaining: <strong>${remaining.toFixed(4)} TFC</strong> of ${total.toFixed(2)} TFC total (${percent}% left)</p>
          <p>Requests from this project will be blocked when the budget reaches 0.</p>
          <a href="${process.env.FRONTEND_URL}" 
             style="display:inline-block;background:#f59e0b;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">
            Increase Project Budget
          </a>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send project budget alert:', err);
  }
}

// Purchase confirmation
async function sendPurchaseConfirmation(email, amount, newBalance) {
  try {
    await resend.emails.send({
      from: 'TokenForge <receipts@tokenforge.ai>',
      to: email,
      subject: '✅ TFC Purchase Confirmed — TokenForge',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#22c55e">✅ Purchase Confirmed</h2>
          <p>Thank you for your purchase!</p>
          <p>Amount added: <strong>${amount} TFC ($${amount} USD)</strong></p>
          <p>New balance: <strong>${newBalance.toFixed(4)} TFC ($${newBalance.toFixed(2)} USD)</strong></p>
          <p style="color:#888;font-size:0.85rem;margin-top:24px">
            You will receive alerts when your balance reaches 20% and 10%.
          </p>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send purchase confirmation:', err);
  }
}

module.exports = {
  sendLowBalanceAlert20,
  sendLowBalanceAlert10,
  sendProjectBudgetAlert,
  sendPurchaseConfirmation
};