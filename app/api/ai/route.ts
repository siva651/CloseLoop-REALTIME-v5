import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  kind: z.enum(["chat", "brief", "followup"]),
  prompt: z.string().min(1).max(6000),
  context: z.string().min(1).max(60000),
});

type Provider = { name: string; key: string; url: string; model: string };

type ModelsResponse = { data?: Array<{ id?: string; access_tier?: string; pricing?: { prompt?: string; completion?: string } }> };

async function jsonFetch(url: string, init: RequestInit, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(`${res.status}: ${typeof data === "string" ? data.slice(0, 240) : JSON.stringify(data).slice(0, 240)}`);
    return data;
  } finally { clearTimeout(timeout); }
}

async function xKiroFreeModel(key: string) {
  try {
    const data = await jsonFetch("https://api.xkiro.com/v1/models", { headers: { Authorization: `Bearer ${key}` } }, 7000) as ModelsResponse;
    return data.data?.find(m => m.access_tier === "free" && m.id)?.id ?? null;
  } catch { return null; }
}

function textFrom(data: unknown) {
  const root = data as { choices?: Array<{ message?: { content?: unknown } }> };
  return typeof root.choices?.[0]?.message?.content === "string" ? root.choices[0].message.content : "";
}

function cleanFollowup(text: string) {
  const subject = text.match(/(?:^|\n)\s*Subject\s*:\s*(.+?)(?:\n|$)/i)?.[1]?.trim();
  const body = text.match(/(?:^|\n)\s*Body\s*:\s*([\s\S]*)/i)?.[1]?.trim();
  if (subject && body) {
  const cleanedBody = body
    .replace(
      /^(analysis|thinking process|reasoning)\s*[:\-][\s\S]*?(?=\n\n|$)/i,
      ""
    )
    .trim();

  return `Subject: ${subject}\n\nBody:\n${cleanedBody}`;
}
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const useful = lines.filter(line => !/^(analysis|thinking process|reasoning|step \d+|constraints?|output format)\s*[:\-]?/i.test(line));
  return useful.slice(-12).join("\n");
}

export async function GET() {
  const configured = [
    process.env.OPENROUTER_API_KEY ? "OpenRouter" : null,
    process.env.REQUESTY_API_KEY ? "Requesty" : null,
    process.env.XKIRO_API_KEY ? "xKiro" : null,
  ].filter(Boolean);
  return NextResponse.json({ configured, primary: configured[0] ?? null });
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const providers: Provider[] = [];
    if (process.env.OPENROUTER_API_KEY) providers.push({ name:"OpenRouter", key:process.env.OPENROUTER_API_KEY, url:"https://openrouter.ai/api/v1/chat/completions", model:process.env.OPENROUTER_MODEL?.trim() || "openrouter/free" });
    if (process.env.REQUESTY_API_KEY && process.env.REQUESTY_MODEL?.trim()) providers.push({ name:"Requesty", key:process.env.REQUESTY_API_KEY, url:"https://router.requesty.ai/v1/chat/completions", model:process.env.REQUESTY_MODEL.trim() });
    if (process.env.XKIRO_API_KEY) {
      const model = process.env.XKIRO_MODEL?.trim() || await xKiroFreeModel(process.env.XKIRO_API_KEY);
      if (model) providers.push({ name:"xKiro", key:process.env.XKIRO_API_KEY, url:"https://api.xkiro.com/v1/chat/completions", model });
    }
    if (!providers.length) return NextResponse.json({ error:"No AI provider is configured. Put an API key in .env.local and restart the dev server." }, { status: 503 });

    const system = body.kind === "followup"
      ? "You are the collections operator inside CloseLoop. Draft a concise professional payment follow-up using only the supplied record evidence. Never invent facts, dates, discounts, promises, or contact details. Do not reveal your analysis, reasoning, checklist, constraints, or thinking process. Your entire response must contain only two sections: Subject: and Body:."
      : body.kind === "brief"
        ? "You are CloseLoop's operations analyst. Summarize the current live data into a decisive operator brief. Use only supplied facts. Return exactly: WHAT MATTERS, WHY IT MATTERS, NEXT 3 MOVES. Keep it concise."
        : "You are CloseLoop Copilot. Answer questions about the supplied operational dataset. Use only supplied facts, show the relevant invoice IDs/amounts when useful, say when information is unavailable, and never invent records.";

    let lastError = "Provider failed";
    for (const provider of providers) {
      try {
        const data = await jsonFetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.key}`,
            "Content-Type": "application/json",
            ...(provider.name === "OpenRouter" ? { "HTTP-Referer": "http://localhost:3000", "X-Title": "CloseLoop" } : {}),
          },
          body: JSON.stringify({
            model: provider.model,
            temperature: 0.15,
            max_tokens: 700,
            messages: [{ role: "system", content: system }, { role: "user", content: `DATA CONTEXT:\n${body.context}\n\nREQUEST:\n${body.prompt}` }],
          }),
        }, 22000);
        const rawText = textFrom(data).trim();
        const text = body.kind === "followup" ? cleanFollowup(rawText) : rawText;
        if (text) return NextResponse.json({ text, provider: provider.name, model: provider.model });
        lastError = `${provider.name} returned an empty response`;
      } catch (e) { lastError = e instanceof Error ? `${provider.name}: ${e.message}` : `${provider.name}: provider failed`; }
    }
    return NextResponse.json({ error:`All configured AI providers failed. ${lastError}` }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error:e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
