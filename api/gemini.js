"use strict";

const ALLOWED_ORIGIN = "https://thiagollipe-web.github.io";
const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = "openai/gpt-oss-20b";
const MAX_PROMPT = 12000;
const MAX_HISTORY = 12;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function normalizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY)
    .filter(item => item && Array.isArray(item.parts) && item.parts.length)
    .map(item => ({
      role: item.role === "model" ? "assistant" : "user",
      text: item.parts
        .filter(part => part && typeof part.text === "string")
        .map(part => part.text.slice(0, MAX_PROMPT))
        .join("\n")
    }))
    .filter(item => item.text);
}

async function callGemini(prompt, history) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

  const contents = normalizeHistory(history).map(item => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.text }]
  }));
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(GEMINI_MODEL) + ":generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "Você é Anabel, uma assistente de desenvolvimento em português do Brasil. Responda com precisão, preserve contexto e entregue código seguro e executável quando solicitado."
          }]
        },
        contents
      })
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Erro na API Gemini.");

  const text = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts.map(part => part?.text || "").join("")
    : "";

  if (!text) throw new Error("Gemini não retornou texto.");
  return { text, provider: "gemini", model: GEMINI_MODEL };
}

async function callGroq(prompt, history) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY não configurada.");

  const messages = [{
    role: "system",
    content: "Você é Anabel, uma assistente de desenvolvimento em português do Brasil. Responda com precisão, preserve contexto e entregue código seguro e executável quando solicitado."
  }];

  for (const item of normalizeHistory(history)) {
    messages.push({ role: item.role, content: item.text });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + process.env.GROQ_API_KEY
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.4,
      max_completion_tokens: 2048
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Erro na API Groq.");

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq não retornou texto.");
  return { text, provider: "groq", model: GROQ_MODEL };
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  try {
    const body = req.body || {};
    const prompt = String(body.prompt || "").trim();

    if (!prompt) return res.status(400).json({ error: "Prompt vazio." });
    if (prompt.length > MAX_PROMPT) return res.status(413).json({ error: "Prompt muito grande." });

    try {
      const result = await callGemini(prompt, body.history);
      return res.status(200).json(result);
    } catch (geminiError) {
      try {
        const result = await callGroq(prompt, body.history);
        return res.status(200).json({
          ...result,
          fallback: "gemini"
        });
      } catch (groqError) {
        return res.status(503).json({
          error: "Gemini e Groq indisponíveis.",
          providers: {
            gemini: geminiError.message,
            groq: groqError.message
          }
        });
      }
    }
  } catch (error) {
    return res.status(500).json({ error: "Falha interna no gateway de IA." });
  }
};
