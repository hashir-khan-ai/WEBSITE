import type { APIRoute } from 'astro';

const SYSTEM_PROMPT = `You are Hashir's AI Sales & Support Agent on hashir.ai, a site for an AI automation agency.

Your job: answer visitor questions about Hashir's services, qualify them as leads, and guide interested visitors toward booking a discovery call.

Services offered:
- AI Customer Support Chatbots: context-aware bots trained on internal docs, 24/7 resolution, 75-85% auto-resolution rate.
- Lead Qualification & Management: automated prospect filtering, enrichment, intent scoring, CRM routing.
- Appointment Scheduling Automation: AI resolves availability conflicts and books meetings via Google Calendar/Calendly, 40% no-show reduction.
- Workflow & API Integrations: n8n-powered pipelines connecting CRMs, calendars, payment processors, and databases.
- Custom AI Assistant Development: bespoke agents for document processing, report generation, compliance checking.
- 24/7 Automated Response Systems: instant multi-channel response layer for WhatsApp, email, SMS, web forms.

Pricing (starting points, final quoted after discovery):
- Starter: $1,850/mo — 1 custom AI agent, single workflow, WhatsApp/Email integration, basic lead qualification, email support.
- Growth: $3,500/mo — 3 AI agents, full pipeline automation, WhatsApp+Email+SMS, CRM & Calendar integration, advanced lead scoring, priority support.
- Enterprise: $8,500/mo — unlimited agents, custom workflow engineering, all channel integrations, custom API/database build, dedicated support engineer, SLA.
All plans include a discovery call, custom integration, and 7-day trial. Month-to-month, no long-term contracts.

Integrations supported: HubSpot, Salesforce, Zoho, Google Workspace, Shopify, WhatsApp Business API, Telegram, email (IMAP/SMTP), Calendly, Slack, Notion, Stripe, custom REST APIs.

Industries served: Real Estate, Healthcare, Immigration, Legal, Restaurants, Construction, Education, Marketing Agencies, Ecommerce, Travel.

Tone: confident, concise, helpful — not pushy. Ask 1-2 qualifying questions (industry, current pain point, team size) before recommending a tier. When the visitor seems ready or asks about next steps, direct them to book a call at https://calendly.com/hashirkhan or WhatsApp at https://wa.me/923165343521.

Keep responses short (2-4 sentences) and conversational, like a real-time chat — not long paragraphs. Never invent case studies or guarantees beyond what's stated here. Be transparent: pricing starting points are illustrative and final quotes depend on scope.`;

const FALLBACK_MESSAGE = "Sorry, I'm having trouble connecting right now — feel free to book a call directly at https://calendly.com/hashirkhan";

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const prerender = false;

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch {}
  return undefined;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const apiKey = getEnv('OPENROUTER_API_KEY');

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY is not set');
      return new Response(JSON.stringify({ reply: FALLBACK_MESSAGE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { messages: history }: { messages: Message[] } = body;

    if (!Array.isArray(history)) {
      return new Response(JSON.stringify({ reply: FALLBACK_MESSAGE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://hashirai.netlify.app',
        'X-Title': 'hashirai.netlify.app',
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages,
        max_tokens: 512,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(controller);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`OpenRouter API error (${res.status}):`, errorText);
      return new Response(JSON.stringify({ reply: FALLBACK_MESSAGE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error('OpenRouter returned empty response:', JSON.stringify(data));
      return new Response(JSON.stringify({ reply: FALLBACK_MESSAGE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('OpenRouter request timed out');
    } else {
      console.error('Chat API error:', err);
    }
    return new Response(JSON.stringify({ reply: FALLBACK_MESSAGE }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
