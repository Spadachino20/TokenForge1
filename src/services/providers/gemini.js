const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../../config/db');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function getModelPricing(model) {
  const result = await db.query(
    'SELECT input_cost_per_1k, output_cost_per_1k, markup_multiplier FROM model_pricing WHERE model = $1',
    [model]
  );
  
  if (result.rows.length === 0) {
    const fallback = await db.query(
      'SELECT input_cost_per_1k, output_cost_per_1k, markup_multiplier FROM model_pricing WHERE model = $1',
      ['gemini-2.0-flash-lite']
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

// Convert OpenAI format to Gemini format
function convertMessages(messages) {
  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  return { system: systemMessage?.content, messages: chatMessages };
}

async function chatCompletion(requestBody, onChunk) {
  const {model = 'gemini-2.0-flash-lite', messages, stream = true, ...rest } = requestBody;

  try {
    const geminiModel = genAI.getGenerativeModel({ model });
    const { system, messages: geminiMessages } = convertMessages(messages);

    const chat = geminiModel.startChat({
      history: geminiMessages.slice(0, -1),
      systemInstruction: system,
      generationConfig: {
        maxOutputTokens: rest.max_tokens || 4096,
        temperature: rest.temperature,
        ...rest
      }
    });

    const lastMessage = geminiMessages[geminiMessages.length - 1];

    if (stream) {
      const result = await chat.sendMessageStream(lastMessage.parts[0].text);

      let tokensIn = 0;
      let tokensOut = 0;

      // Conservative estimate
      tokensIn = Math.ceil(messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0) / 3) * 1.2;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        tokensOut += text.length / 4;
        onChunk({
          choices: [{
            delta: { content: text }
          }]
        });
      }

      const cost = await calculateCost(model, Math.ceil(tokensIn), Math.ceil(tokensOut));
      return { cost, tokensIn: Math.ceil(tokensIn), tokensOut: Math.ceil(tokensOut) };
    } else {
      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const response = await result.response;
      const text = response.text();

      const tokensIn = Math.ceil(messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0) / 3) * 1.2;
      const tokensOut = text.length / 4;
      const cost = await calculateCost(model, Math.ceil(tokensIn), Math.ceil(tokensOut));

      return {
        response: {
          choices: [{
            message: {
              role: 'assistant',
              content: text
            }
          }]
        },
        cost,
        tokensIn: Math.ceil(tokensIn),
        tokensOut: Math.ceil(tokensOut)
      };
    }
  } catch (err) {
    console.error('Gemini error:', err.message);
    throw err;
  }
}

module.exports = {
  chatCompletion,
  calculateCost,
  convertMessages
};
