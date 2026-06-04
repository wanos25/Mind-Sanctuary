// R7 — AI assistance for clinicians.
// Modes (tool-calling, structured output):
//   suggest_prompts | suggest_cbt_exercises | suggest_content_tags
//   summarize_patient_trends | suggest_followups | draft_activity
//
// All output is SUGGESTION ONLY — never written to activity_assets.published
// or auto-applied. The clinician must explicitly accept and save.
//
// SECURITY:
//   - JWT verified (getClaims)
//   - Doctor role checked server-side via has_role()
//   - For patient-scoped modes, the caller must pass target_user_id and the
//     server only fetches LIMITED rows (last 30 days, capped 50 rows)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Mode =
  | 'suggest_prompts'
  | 'suggest_cbt_exercises'
  | 'suggest_content_tags'
  | 'summarize_patient_trends'
  | 'suggest_followups'
  | 'draft_activity';

interface Body {
  mode: Mode;
  context?: string;
  target_user_id?: string;
  hint?: string;
  locale?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const TOOL_SCHEMAS: Record<Mode, { name: string; description: string; parameters: Record<string, unknown> }> = {
  suggest_prompts: {
    name: 'suggest_prompts',
    description: 'Return reflection prompt suggestions for therapy sessions.',
    parameters: {
      type: 'object',
      properties: {
        prompts: {
          type: 'array', minItems: 3, maxItems: 6,
          items: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              rationale: { type: 'string' },
              emotional_target: { type: 'string' },
            },
            required: ['prompt', 'rationale'],
            additionalProperties: false,
          },
        },
      },
      required: ['prompts'], additionalProperties: false,
    },
  },
  suggest_cbt_exercises: {
    name: 'suggest_cbt_exercises',
    description: 'Return CBT exercise outlines as graph nodes.',
    parameters: {
      type: 'object',
      properties: {
        exercises: {
          type: 'array', minItems: 2, maxItems: 4,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              goal: { type: 'string' },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', enum: ['reflection', 'question', 'checkpoint'] },
                    text: { type: 'string' },
                  },
                  required: ['kind', 'text'],
                },
              },
            },
            required: ['title', 'goal', 'steps'],
          },
        },
      },
      required: ['exercises'],
    },
  },
  suggest_content_tags: {
    name: 'suggest_content_tags',
    description: 'Return therapeutic tags for educational content.',
    parameters: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 12 },
        emotional_goal: { type: 'string' },
      },
      required: ['tags'],
    },
  },
  summarize_patient_trends: {
    name: 'summarize_patient_trends',
    description: 'Summarize patient emotional trends from anonymized window.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        dominant_emotions: { type: 'array', items: { type: 'string' } },
        risk_level: { type: 'string', enum: ['low', 'moderate', 'high'] },
        observations: { type: 'array', items: { type: 'string' } },
        recommendations: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'risk_level'],
    },
  },
  suggest_followups: {
    name: 'suggest_followups',
    description: 'Suggest follow-up therapeutic activities.',
    parameters: {
      type: 'object',
      properties: {
        followups: {
          type: 'array', minItems: 2, maxItems: 5,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              kind: { type: 'string', enum: ['cbt_flow', 'image_interpretation', 'educational_video', 'spot_difference'] },
              rationale: { type: 'string' },
            },
            required: ['title', 'kind', 'rationale'],
          },
        },
      },
      required: ['followups'],
    },
  },
  draft_activity: {
    name: 'draft_activity',
    description: 'Draft a complete activity (CBT v2 by default).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        kind: { type: 'string', enum: ['cbt_flow'] },
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['reflection', 'question', 'checkpoint'] },
              title: { type: 'string' },
              prompt: { type: 'string' },
            },
            required: ['kind', 'prompt'],
          },
        },
      },
      required: ['title', 'kind', 'nodes'],
    },
  },
};

async function fetchPatientWindow(target_user_id: string) {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const sinceISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [emotionsRes, msgsRes] = await Promise.all([
    admin.from('emotion_analyses')
      .select('primary_emotion,intensity,sentiment,distortions,created_at')
      .eq('user_id', target_user_id)
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('chat_messages')
      .select('role,content,created_at')
      .eq('user_id', target_user_id)
      .eq('role', 'user')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  const emotions = (emotionsRes.data ?? []).map((e: any) => ({
    primary_emotion: e.primary_emotion, intensity: e.intensity, sentiment: e.sentiment,
    distortions: e.distortions, at: e.created_at,
  }));
  // truncate to mitigate context leakage
  const messages = (msgsRes.data ?? []).map((m: any) => ({
    role: m.role, at: m.created_at,
    text: (m.content ?? '').toString().slice(0, 280),
  }));
  return { emotions, messages };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY not configured' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const callerId = claimsData.claims.sub as string;

    // doctor role check
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles').select('role').eq('user_id', callerId).in('role', ['doctor', 'admin']).maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden — doctor role required' }, 403);

    const body = (await req.json()) as Body;
    const mode = body.mode;
    if (!mode || !(mode in TOOL_SCHEMAS)) return json({ error: 'Invalid mode' }, 400);

    let patientContext = '';
    if (mode === 'summarize_patient_trends' || mode === 'suggest_followups') {
      if (!body.target_user_id) return json({ error: 'target_user_id required for this mode' }, 400);
      const { emotions, messages } = await fetchPatientWindow(body.target_user_id);
      patientContext = `\n\nPatient window (last 30d, minimized):\n` +
        `Emotions: ${JSON.stringify(emotions).slice(0, 4000)}\n` +
        `Recent user excerpts: ${JSON.stringify(messages).slice(0, 4000)}`;
    }

    const sys = `You are a clinical assistant supporting a licensed therapist.
You output SUGGESTIONS ONLY. Never claim certainty. Never include patient PII.
Locale: ${body.locale ?? 'en'}. Be concise, evidence-informed, and trauma-aware.`;
    const user = `Mode: ${mode}\nContext from doctor: ${body.context ?? ''}\nHint: ${body.hint ?? ''}${patientContext}`;

    const tool = TOOL_SCHEMAS[mode];
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        tools: [{ type: 'function', function: tool }],
        tool_choice: { type: 'function', function: { name: tool.name } },
      }),
    });
    if (resp.status === 429) return json({ error: 'Rate limited. Try again shortly.' }, 429);
    if (resp.status === 402) return json({ error: 'AI credits exhausted.' }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      console.error('AI gateway error', resp.status, t.slice(0, 500));
      return json({ error: 'AI gateway error' }, 500);
    }
    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return json({ error: 'No tool call returned' }, 500);
    let parsed: unknown;
    try { parsed = JSON.parse(call.function.arguments); }
    catch { return json({ error: 'Malformed tool args' }, 500); }

    return json({ mode, result: parsed, ai_generated: true });
  } catch (e) {
    console.error('doctor-ai-assist', e);
    return json({ error: (e as Error).message }, 500);
  }
});