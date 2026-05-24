const Anthropic = require('@anthropic-ai/sdk');
const db = require('../../config/db');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function getModelPricing(model) {
  const result = await db.query(
    'SELECT input_cost_per_1k, output_cost_per_1k, markup_multiplier FROM model_pricing WHERE model = $1',
    [model]
  );
  
  if (result.rows.length === 0) {
    const fallback = await db.query(
      'SELECT input_cost_per_1k, output_cost_per_1k, markup_multiplier FROM model_pricing WHERE model = $1',
      ['claude-3-sonnet-20240229']
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

// Convert OpenAI format to Anthropic format
function convertMessages(messages) {
  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

  return {
    system: systemMessage?.content,
    messages: chatMessages
  };
}

async function chatCompletion(requestBody, onChunk) {
  const { model = 'claude-3-sonnet-20240229', messages, stream = true, ...rest } = requestBody;

  try {
    const { system, messages: anthropicMessages } = convertMessages(messages);

    if (stream) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: rest.max_tokens || 4096,
        system,
        messages: anthropicMessages,
        stream: true,
        ...rest
      });

      let tokensIn = 0;
      let tokensOut = 0;

      // Conservative estimate
      tokensIn = Math.ceil(messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0) / 3) * 1.2;

      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          tokensOut += chunk.delta.text.length / 4;
        }
        // Convert to OpenAI-like format
        onChunk({
          choices: [{
            delta: { content: chunk.delta?.text || '' }
          }]
        });
      }

      const cost = await calculateCost(model, Math.ceil(tokensIn), Math.ceil(tokensOut));
      return { cost, tokensIn: Math.ceil(tokensIn), tokensOut: Math.ceil(tokensOut) };
    } else {
      const response = await anthropic.messages.create({
        model,
        max_tokens: rest.max_tokens || 4096,
        system,
        messages: anthropicMessages,
        stream: false,
        ...rest
      });

      const tokensIn = response.usage?.input_tokens || 0;
      const tokensOut = response.usage?.output_tokens || 0;
      const cost = await calculateCost(model, tokensIn, tokensOut);

      // Convert to OpenAI-like format
      const openAIResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: response.content[0]?.text || ''
          }
        }],
        usage: {
          prompt_tokens: tokensIn,
          completion_tokens: tokensOut,
          total_tokens: tokensIn + tokensOut
        }
      };

      return { response: openAIResponse, cost, tokensIn, tokensOut };
    }
  } catch (err) {
    console.error('Anthropic error:', err.message);
    throw err;
  }
}

module.exports = {
  chatCompletion,
  calculateCost,
  convertMessages
};
