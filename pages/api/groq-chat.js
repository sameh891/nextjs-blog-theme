const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = 'llama-3.1-8b-instant';
const FALLBACK_MODEL = 'mixtral-8x7b-32768';

async function requestCompletion({ model, messages, apiKey }) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed using model ${model}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed.' });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY in environment variables.' });
  }

  const { messages } = req.body || {};

  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages must be a non-empty array.' });
  }

  const systemPrompt = {
    role: 'system',
    content:
      'You are an expert assistant in Physical Therapy for Women\'s Health. Provide evidence-aware guidance, summarize findings in clear points, and mention when the user should consult licensed clinicians.',
  };

  const conversation = [systemPrompt, ...messages];

  try {
    const primary = await requestCompletion({
      model: PRIMARY_MODEL,
      messages: conversation,
      apiKey,
    });

    return res.status(200).json({
      model: PRIMARY_MODEL,
      content: primary.choices?.[0]?.message?.content || '',
    });
  } catch (primaryError) {
    try {
      const fallback = await requestCompletion({
        model: FALLBACK_MODEL,
        messages: conversation,
        apiKey,
      });

      return res.status(200).json({
        model: FALLBACK_MODEL,
        content: fallback.choices?.[0]?.message?.content || '',
        fallbackUsed: true,
      });
    } catch (fallbackError) {
      return res.status(500).json({
        error: 'Unable to generate chat response with primary and fallback models.',
        primaryError: primaryError.message,
        fallbackError: fallbackError.message,
      });
    }
  }
}
