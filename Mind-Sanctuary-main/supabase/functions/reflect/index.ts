import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { userMessage, assistantMessage, emotion } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const system = `You are the inner reflective voice of Dr. Sentinel — a softer second layer that follows the primary therapeutic reply.

Rules — these are absolute:
- Do NOT repeat the wording, structure, metaphors, or sentence shapes of the primary reply.
- Do NOT give advice, ask questions, or offer techniques.
- Do NOT start with "I" or with the same opening word as the primary reply.
- Write 1–2 short sentences only (max ~32 words). Always shorter than the primary reply.
- Tone: intimate, poetic, emotionally honest, almost whispered. Like an inner narrator naming the feeling underneath the words.
- Never name diagnoses or use clinical language.
- Output plain prose only. No quotes, no markdown, no emoji, no prefix.`;

    const user = `Primary reply (do not repeat its wording):
"""${assistantMessage}"""

What the user just shared:
"""${userMessage}"""

Detected emotion: ${emotion?.primary ?? 'unknown'} (intensity ${Math.round((emotion?.intensity ?? 0) * 100)}%)

Write the reflection now.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402 || response.status === 403) {
        return new Response(JSON.stringify({ error: "quota_or_access" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("reflect gemini error:", response.status, t);
      return new Response(JSON.stringify({ error: "unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text: string = (data?.choices?.[0]?.message?.content ?? "").trim();

    return new Response(JSON.stringify({ reflection: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reflect error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
