---
source_url: https://supabase.com/dashboard/project/duqllomdkhhlitigeqio
captured_at: 2026-07-28
---

# TokenForge Supabase Schema (project: duqllomdkhhlitigeqio, Postgres 17)

Snapshot of table structure and non-sensitive reference data, generated for graphify indexing. Row data for `users`, `api_keys`, `projects`, `usage_logs`, `transactions`, and `notifications` is intentionally excluded (PII / secrets) — only column structure and foreign keys are documented for those.

## Tables

### `users` (3 rows)
Columns: `id` (uuid, pk), `email` (varchar, unique), `password_hash` (varchar), `balance_tfc` (numeric, default 0), `reserved_tfc` (numeric), `created_at`, `updated_at`.
Referenced by: `api_keys.user_id`, `projects.user_id`, `notifications.user_id`, `usage_logs.user_id`, `transactions.user_id`.

### `api_keys` (4 rows)
Columns: `id` (uuid, pk), `user_id` (uuid, fk → users.id), `project_id` (uuid, nullable), `key_hash` (varchar), `name` (varchar), `is_active` (bool, default true), `last_used_at`, `created_at`.
Referenced by: `usage_logs.api_key_id`.

### `projects` (2 rows)
Columns: `id` (uuid, pk), `user_id` (uuid, fk → users.id), `name` (varchar), `description` (text), `monthly_budget_tfc` (numeric, default 0), `is_active` (bool, default true), `created_at`.
Referenced by: `usage_logs.project_id`.

### `usage_logs` (0 rows)
Columns: `id` (uuid, pk), `user_id` (fk → users.id), `api_key_id` (fk → api_keys.id, nullable), `project_id` (fk → projects.id, nullable), `model` (varchar), `provider` (varchar), `tokens_in` (int, default 0), `tokens_out` (int, default 0), `cost_tfc` (numeric), `status` (varchar, default 'success'), `error_message` (text), `created_at`.

### `transactions` (1 row)
Columns: `id` (uuid, pk), `user_id` (fk → users.id), `type` (varchar, default 'purchase'), `amount_tfc` (numeric), `description` (text), `stripe_session_id` (varchar), `stripe_payment_intent_id` (varchar), `created_at`.
Records TFC purchases and balance changes; `type='purchase'` is the default, tied to Stripe checkout sessions/payment intents.

### `stripe_events` (5 rows)
Columns: `id` (varchar, pk — the Stripe event ID), `created_at`.
Idempotency ledger to avoid double-processing Stripe webhook events.

### `model_pricing` (30 rows) — no RLS restriction on read of structure; this is the live pricing table backing the API proxy
Columns: `id` (uuid, pk), `model` (varchar, unique), `provider` (varchar), `display_name` (varchar), `input_cost_per_1k` (numeric), `output_cost_per_1k` (numeric), `context_window` (int), `max_output_tokens` (int), `markup_multiplier` (numeric, default 1.30), `is_active` (bool, default true), `notes` (text), `updated_at`.

Active models (`is_active = true`) as of 2026-07-28, all at `markup_multiplier = 1.20` (20% markup, matching the public pricing pages):

| Provider | Model | Display Name | Input $/1k | Output $/1k | Context | Max Output |
|---|---|---|---|---|---|---|
| anthropic | claude-haiku-4-5-20251001 | Claude Haiku 4.5 | 0.0010 | 0.0050 | 200,000 | 8,192 |
| anthropic | claude-opus-4-8 | Claude Opus 4.8 | 0.0050 | 0.0250 | 1,000,000 | 8,192 |
| anthropic | claude-sonnet-5 | Claude Sonnet 5 | 0.0030 | 0.0150 | 1,000,000 | 8,192 |
| gemini | gemini-3.1-flash-lite | Gemini 3.1 Flash Lite | 0.00025 | 0.0015 | 1,000,000 | 65,536 |
| gemini | gemini-3.1-pro-preview | Gemini 3.1 Pro | 0.0020 | 0.0120 | 1,000,000 | 65,536 |
| gemini | gemini-3.5-flash | Gemini 3.5 Flash | 0.0015 | 0.0090 | 1,000,000 | 65,536 |
| openai | gpt-5.6-luna | GPT-5.6 Luna | 0.0010 | 0.0060 | 1,000,000 | 128,000 |
| openai | gpt-5.6-sol | GPT-5.6 Sol | 0.0050 | 0.0300 | 1,000,000 | 128,000 |
| openai | gpt-5.6-terra | GPT-5.6 Terra | 0.0025 | 0.0150 | 1,000,000 | 128,000 |

Inactive models (kept for historical `usage_logs` reference, not offered to new calls): claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022, claude-3-haiku-20240307, claude-3-opus-20240229, claude-3-sonnet-20240229, claude-haiku-4-5, claude-sonnet-4-6, gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash, gemini-2.0-flash-lite, gemini-3-flash, gpt-3.5-turbo, gpt-4-turbo, gpt-4o, gpt-4o-mini, gpt-5, gpt-5.5, o1, o1-mini, o3-mini.

### `waitlist` (2 rows)
Columns: `id` (uuid, pk), `email` (varchar, unique), `created_at`.

### `notifications` (0 rows)
Columns: `id` (uuid, pk), `user_id` (fk → users.id), `type` (varchar), `sent_at`.

### `provider_balances` (3 rows)
Columns: `provider` (varchar, pk), `estimated_balance_usd` (numeric), `low_balance_threshold_usd` (numeric, default 5.0000), `last_updated_at`, `last_recharge_at`, `notes` (text).
Backs the low-balance alert / auto-block flow described in `public/dashboard.html` and `src/services/providerBalanceService.js`.
