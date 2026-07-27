# TokenForge

One key, every AI model. TFC credits system.

## Quick Start

1. Create a `.env` file with `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `NOWPAYMENTS_API_KEY`, `RESEND_API_KEY` and `FRONTEND_URL`
2. Run `npm install`
3. Run `npm run db:migrate`
4. Run `npm run dev`

## Environment Variables

Required: `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `NOWPAYMENTS_API_KEY`, `RESEND_API_KEY`, `FRONTEND_URL`.

Optional: `ADMIN_EMAILS` (comma-separated; low-balance alerts go nowhere if unset), `PORT`, `NODE_ENV`.

## API Usage

```bash
curl -X POST https://tokenforge1-production.up.railway.app/v1/chat/completions \
  -H "Authorization: Bearer tf_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.6-luna",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Available Models

- OpenAI: gpt-5.6-luna, gpt-5.6-terra, gpt-5.6-sol
- Anthropic: claude-haiku-4-5-20251001, claude-sonnet-5, claude-opus-4-8
- Google: gemini-3.1-flash-lite, gemini-3.5-flash-lite, gemini-3.5-flash, gemini-3.6-flash, gemini-3.1-pro-preview
