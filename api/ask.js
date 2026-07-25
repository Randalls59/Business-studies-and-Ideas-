import OpenAI from 'openai';

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://randalls59.github.io';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });

  const question = String(req.body?.question || '').trim();
  const context = req.body?.context || {};
  if (!question) return res.status(400).json({ error: 'Question is required' });
  if (question.length > 2500) return res.status(400).json({ error: 'Question is too long' });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || 'gpt-5';

  const instructions = `You are Ask SNAP, a practical site-selection and restaurant-feasibility analyst for a Tucson, Arizona beverage and fast-breakfast concept.

Use only the dashboard context supplied with the question. Clearly distinguish:
1. verified or live data,
2. founder assumptions,
3. planning proxy scores,
4. missing diligence.

Never describe zoning, commercial use, drive-through permission, traffic, utilities, appreciation or profitability as verified unless the supplied context explicitly proves it. Never promise success. Prefer direct numerical answers, clear comparisons and a next action. Use US dollars. Keep responses useful and readable for a non-technical founder.`;

  try {
    const response = await client.responses.create({
      model,
      instructions,
      input: `Dashboard context:\n${JSON.stringify(context)}\n\nFounder question:\n${question}`
    });
    return res.status(200).json({ answer: response.output_text });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'The AI request failed' });
  }
}
