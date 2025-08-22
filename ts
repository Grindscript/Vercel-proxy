import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function (req: VercelRequest, res: VercelResponse) {
  const discordWebhookUrl = 'https://discord.com/api/webhooks/1398145421414629539/OoyHqtQmAOtdjq91W5IkFP0wGlGPeZns4BRe4PcTWfSkTDxZ-fnhPee0rYqFt8WiDLMk'; // Replace with your webhook
  const response = await fetch(discordWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
    },
    body: JSON.stringify(req.body)
  });

  const text = await response.text();
  res.status(response.status).send(text);
}
