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
  CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_stripe_id ON transactions(stripe_payment_intent_id);
  `,
  `
  INSERT INTO model_pricing (model, provider, display_name, input_cost_per_1k, output_cost_per_1k, context_window, max_output_tokens, markup_multiplier) VALUES
  ('gpt-4o',               'openai',    'GPT-4o',           0.0025,    0.01,    128000, 16384, 1.30),
  ('gpt-4o-mini',          'openai',    'GPT-4o Mini',      0.00015,   0.0006,  128000, 16384, 1.30),
  ('gpt-4-turbo',          'openai',    'GPT-4 Turbo',      0.01,      0.03,    128000,  4096, 1.30),
  ('gpt-3.5-turbo',        'openai',    'GPT-3.5 Turbo',    0.0005,    0.0015,  16385,   4096, 1.30),
  ('claude-3-opus-20240229',  'anthropic', 'Claude 3 Opus',   0.015,     0.075,   200000,  4096, 1.30),
  ('claude-3-sonnet-20240229','anthropic', 'Claude 3 Sonnet', 0.003,     0.015,   200000,  4096, 1.30),
  ('claude-3-haiku-20240307', 'anthropic', 'Claude 3 Haiku',  0.00025,   0.00125, 200000,  4096, 1.30),
  ('gemini-1.5-pro',       'gemini',    'Gemini 1.5 Pro',   0.0035,    0.0105,  1000000, 8192, 1.30),
  ('gemini-1.5-flash',     'gemini',    'Gemini 1.5 Flash', 0.00035,   0.00105, 1000000, 8192, 1.30)
  ON CONFLICT (model) DO NOTHING;
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
      // Don't throw - some migrations may already exist
    }
  }
  
  console.log('Migrations complete!');
}

module.exports = { runMigrations };
