const db = require('./db');

const migrations = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance_tfc DECIMAL(10, 4) DEFAULT 0.0000,
    reserved_tfc DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID,
    key_hash VARCHAR(64) NOT NULL,
    name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    monthly_budget_tfc DECIMAL(10, 4) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id),
    project_id UUID REFERENCES projects(id),
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost_tfc DECIMAL(10, 6) NOT NULL,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'purchase',
    amount_tfc DECIMAL(10, 4) NOT NULL,
    description TEXT,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS stripe_events (
    id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS model_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model VARCHAR(100) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    display_name VARCHAR(255),
    input_cost_per_1k DECIMAL(12, 10) NOT NULL,
    output_cost_per_1k DECIMAL(12, 10) NOT NULL,
    context_window INTEGER,
    max_output_tokens INTEGER,
    markup_multiplier DECIMAL(5, 2) DEFAULT 1.20,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS provider_balances (
    provider VARCHAR(50) PRIMARY KEY,
    estimated_balance_usd DECIMAL(10, 4) NOT NULL DEFAULT -1.0000,
    low_balance_threshold_usd DECIMAL(10, 4) NOT NULL DEFAULT 5.0000,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_recharge_at TIMESTAMP,
    notes TEXT
  );

  INSERT INTO provider_balances (provider, estimated_balance_usd, low_balance_threshold_usd)
  VALUES
    ('openai', -1.0000, 5.0000),
    ('anthropic', -1.0000, 5.0000),
    ('gemini', -1.0000, 5.0000)
  ON CONFLICT (provider) DO NOTHING;
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_stripe_id ON transactions(stripe_payment_intent_id);
  `,
  `
INSERT INTO model_pricing (model, provider, display_name, input_cost_per_1k, output_cost_per_1k, context_window, max_output_tokens, markup_multiplier) VALUES
('gpt-5.6-luna',               'openai',    'GPT-5.6 Luna',         0.001,    0.006,   1000000, 128000, 1.20),
('gpt-5.6-terra',              'openai',    'GPT-5.6 Terra',        0.0025,   0.015,   1000000, 128000, 1.20),
('gpt-5.6-sol',                'openai',    'GPT-5.6 Sol',          0.005,    0.030,   1000000, 128000, 1.20),
('claude-haiku-4-5-20251001',  'anthropic', 'Claude Haiku 4.5',     0.001,    0.005,   200000,  8192,   1.20),
('claude-sonnet-5',            'anthropic', 'Claude Sonnet 5',      0.003,    0.015,   1000000, 8192,   1.20),
('claude-opus-4-8',            'anthropic', 'Claude Opus 4.8',      0.005,    0.025,   1000000, 128000, 1.20),
('gemini-3.1-flash-lite',      'gemini',    'Gemini 3.1 Flash Lite',0.00025,  0.0015,  1000000, 65536,  1.20),
('gemini-3.5-flash-lite',      'gemini',    'Gemini 3.5 Flash Lite',0.0003,   0.0025,  1000000, 65536,  1.20),
('gemini-3.5-flash',           'gemini',    'Gemini 3.5 Flash',     0.0015,   0.009,   1000000, 65536,  1.20),
('gemini-3.6-flash',           'gemini',    'Gemini 3.6 Flash',     0.0015,   0.0075,  1000000, 65536,  1.20),
('gemini-3.1-pro-preview',     'gemini',    'Gemini 3.1 Pro',       0.002,    0.012,   1000000, 65536,  1.20)
ON CONFLICT (model) DO UPDATE SET
  markup_multiplier = EXCLUDED.markup_multiplier,
  input_cost_per_1k = EXCLUDED.input_cost_per_1k,
  output_cost_per_1k = EXCLUDED.output_cost_per_1k,
  display_name = EXCLUDED.display_name,
  is_active = true;

UPDATE model_pricing SET is_active = false
WHERE model NOT IN (
  'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol',
  'claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-4-8',
  'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash',
  'gemini-3.6-flash', 'gemini-3.1-pro-preview'
);
  `
];
async function runMigrations() {
  console.log('Running migrations...');
  
  for (let i = 0; i < migrations.length; i++) {
    try {
      await db.query(migrations[i]);
      console.log(`✅ Migration ${i + 1}/${migrations.length} completed`);
    } catch (err) {
      console.error(`❌ Migration ${i + 1} failed:`, err.message);
    }
  }
  
  console.log('Migrations complete!');
}

module.exports = { runMigrations };