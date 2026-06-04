// Multi-provider chat edge function with graceful failover.
// Priority: Gemini → Groq → OpenRouter → Lovable AI (optional fallback).
// All providers stream SSE in OpenAI chat-completions format.
// Backend lock: fsterbxivhhzipfgpvou. Do not change.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildPersonalizedSystemPrompt } from "../_shared/promptPersonalization.ts";
import { requireAuth } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Provider = {
  name: string;
  enabled: boolean;
  url: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
};

const PROVIDER_TIMEOUT_MS = 25_000;

function buildProviders(): Provider[] {
  const GEMINI = Deno.env.get("GEMINI_API_KEY") ?? "";
  const GROQ = Deno.env.get("GROQ_API_KEY") ?? "";
  const OPENROUTER = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY") ?? "";

  return [
    {
      name: "gemini",
      enabled: !!GEMINI,
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: GEMINI,
      model: "gemini-2.0-flash",
    },
    {
      name: "groq",
      enabled: !!GROQ,
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: GROQ,
      model: "llama-3.3-70b-versatile",
    },
    {
      name: "openrouter",
      enabled: !!OPENROUTER,
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: OPENROUTER,
      model: "google/gemini-2.0-flash-exp:free",
      extraHeaders: {
        "HTTP-Referer": "https://wannos-1-4.lovable.app",
        "X-Title": "Mind Sentinel",
      },
    },
    {
      name: "lovable",
      enabled: !!LOVABLE,
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      apiKey: LOVABLE,
      model: "google/gemini-2.5-flash",
    },
  ];
}

async function tryProvider(
  provider: Provider,
  messages: unknown[],
  systemPrompt: string,
): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const resp = await fetch(provider.url, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        ...(provider.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "system", content: systemPrompt }, ...messages as object[]],
        stream: true,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(`[chat] provider=${provider.name} status=${resp.status} body=${text.slice(0, 200)}`);
      throw new Error(`provider_${provider.name}_status_${resp.status}`);
    }
    if (!resp.body) throw new Error(`provider_${provider.name}_empty_body`);
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  // Parse body defensively — never 500 on malformed input.
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (e) {
    console.warn("[chat] invalid json body:", e);
    return new Response(
      JSON.stringify({ error: "invalid_json_body", fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const messages = Array.isArray((body as { messages?: unknown }).messages)
    ? ((body as { messages: unknown[] }).messages)
    : [];

  if (messages.length > 80) {
    console.warn("[chat] rejected: too many messages", { count: messages.length, userId: auth.userId });
    return new Response(
      JSON.stringify({ error: "payload_too_large", fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.info("[chat] request", { userId: auth.userId, messageCount: messages.length });
  const interviewContext = (body as { interviewContext?: { _mode?: string; _systemOverride?: string } }).interviewContext;
  const emotionState = (body as { emotionState?: { primary: string; intensity: number; sentiment: number; distortions?: string[] } }).emotionState;
  const memories = (body as { memories?: Array<{ topic: string; emotion_pattern?: string; context?: string }> }).memories;
  const systemAddenda = (body as { systemAddenda?: string[] }).systemAddenda;
  const userProfile = (body as { userProfile?: { gender?: string; nickname?: string; preferredLanguage?: string } }).userProfile;

  let systemPrompt = "";
  try {
    systemPrompt = buildPersonalizedSystemPrompt({
      isInterview: interviewContext?._mode === "interview",
      interviewSystemOverride: interviewContext?._systemOverride,
      memories,
      interviewContext,
      emotionState,
      systemAddenda,
      userProfile,
    });
  } catch (e) {
    console.warn("[chat] buildSystemPrompt failed, using minimal fallback:", e);
    systemPrompt = "You are Dr. Sentinel, an empathetic AI mental health assistant. Reply in the user's language.";
  }

  const all = buildProviders();
  const providers = all.filter((p) => p.enabled);
  console.log(`[chat] providers configured=${all.map((p) => `${p.name}:${p.enabled}`).join(",")}`);

  if (providers.length === 0) {
    console.error("[chat] no providers configured");
    return new Response(
      JSON.stringify({
        error: "no_providers",
        message: "No AI providers configured. Add GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, or LOVABLE_API_KEY.",
        fallback: true,
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const errors: string[] = [];
  for (const p of providers) {
    try {
      console.log(`[chat] attempting provider=${p.name} model=${p.model}`);
      const upstream = await tryProvider(p, messages, systemPrompt);
      console.log(`[chat] selected provider=${p.name}`);
      return new Response(upstream.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "X-AI-Provider": p.name,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${p.name}:${msg}`);
      console.warn(`[chat] provider=${p.name} failed, falling back. err=${msg}`);
    }
  }

  console.error(`[chat] all providers failed: ${errors.join(" | ")}`);
  return new Response(
    JSON.stringify({
      error: "all_providers_failed",
      message: "All AI providers failed. Please try again shortly.",
      attempted: errors,
      fallback: true,
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
