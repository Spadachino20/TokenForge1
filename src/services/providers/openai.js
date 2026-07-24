const OpenAI = require('openai');
const db = require('../../config/db');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getModelPricing(model) {
  const result = await db.query(
    'SELECT input_cost_per_1k, output_cost_per_1k, markup_multiplier FROM model_pricing WHERE model = $1',
    [model]
  );
  
  if (result.rows.length === 0) {
    // Fallback to gpt-5.6-luna pricing
    const fallback = await db.query(
      'SELECT input_cost_per_1k, output_cost_per_1k, markup_multiplier FROM model_pricing WHERE model = $1',
      ['gpt-5.6-luna']
    );
    return fallback.rows[0];
  }
  
  return result.rows[0];
}

async function calculateCost(model, tokensIn, tokensOut) {
  const pricing = await getModelPricing(model);
  const inputCost = (tokensIn / 1000) * pricing.input_cost_per_1k;
  const outputCost = (tokensOut / 1000) * pricing.output_cost_per_1k;
  const totalCost = inputCost + outputCost;
  return totalCost * pricing.markup_multiplier;
}

async function chatCompletion(requestBody, onChunk) {
  const { model = 'gpt-5.6-luna', messages, stream = true, ...rest } = requestBody;

  try {
    if (stream) {
      const response = await openai.chat.completions.create({
        model,
        messages,
        stream: true,
        ...rest
      });

      let tokensIn = 0;
      let tokensOut = 0;

      // Estimate input tokens (conservative: content.length / 3 * 1.2)
      tokensIn = Math.ceil(messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0) / 3) * 1.2;

      for await (const chunk of response) {
        if (chunk.choices[0]?.delta?.content) {
          tokensOut += chunk.choices[0].delta.content.length / 4;
        }
        onChunk(chunk);
      }

      const cost = await calculateCost(model, Math.ceil(tokensIn), Math.ceil(tokensOut));
      return { cost, tokensIn: Math.ceil(tokensIn), tokensOut: Math.ceil(tokensOut) };
    } else {
      const response = await openai.chat.completions.create({
        model,
        messages,
        stream: false,
        ...rest
      });

      const tokensIn = response.usage?.prompt_tokens || 0;
      const tokensOut = response.usage?.completion_tokens || 0;
      const cost = await calculateCost(model, tokensIn, tokensOut);

      return { response, cost, tokensIn, tokensOut };
    }
  } catch (err) {
    console.error('OpenAI error:', err.message);
    throw err;
  }
}

module.exports = {
  chatCompletion,
  calculateCost,
  getModelPricing
};
