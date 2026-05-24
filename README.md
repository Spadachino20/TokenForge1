# TokenForge

One key, every AI model. TFC credits system.

## Quick Start

1. Copy `.env.example` to `.env` and fill in your keys
2. Run `npm install`
3. Run `npm run db:migrate`
4. Run `npm run dev`

## Environment Variables

See `.env.example` for required variables.

## API Usage

```bash
curl -X POST https://api.tokenforge.ai/v1/chat/completions \
  -H "Authorization: Bearer tf_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Available Models

- OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- Anthropic: claude-3-sonnet, claude-3-opus, claude-3-haiku
- Google: gemini-1.5-pro, gemini-1.5-flash
