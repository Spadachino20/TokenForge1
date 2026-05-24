function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Log structured error
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.userId || null,
    apiKeyId: req.apiKeyId || null
  };

  console.error(JSON.stringify(errorLog));

  // Stripe webhook signature errors
  if (err.type === 'StripeSignatureVerificationError') {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorHandler;
