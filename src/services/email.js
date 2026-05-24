const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendLowBalanceAlert(email, balance) {
  try {
    await resend.emails.send({
      from: 'TokenForge <alerts@tokenforge.ai>',
      to: email,
      subject: 'Low Balance Alert - TokenForge',
      html: `
        <h2>Low Balance Alert</h2>
        <p>Your TokenForge balance is running low.</p>
        <p>Current balance: <strong>${balance.toFixed(2)} TFC</strong></p>
        <p><a href="${process.env.FRONTEND_URL}/dashboard">Add credits</a></p>
      `
    });
  } catch (err) {
    console.error('Failed to send low balance alert:', err);
  }
}

async function sendPurchaseConfirmation(email, amount, newBalance) {
  try {
    await resend.emails.send({
      from: 'TokenForge <receipts@tokenforge.ai>',
      to: email,
      subject: 'TFC Purchase Confirmation',
      html: `
        <h2>Thank you for your purchase!</h2>
        <p>You've purchased <strong>${amount} TFC</strong>.</p>
        <p>Your new balance: <strong>${newBalance.toFixed(2)} TFC</strong></p>
        <p><a href="${process.env.FRONTEND_URL}/dashboard">View Dashboard</a></p>
      `
    });
  } catch (err) {
    console.error('Failed to send purchase confirmation:', err);
  }
}

module.exports = {
  sendLowBalanceAlert,
  sendPurchaseConfirmation
};
