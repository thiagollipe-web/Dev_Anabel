"use strict";

const ALLOWED_ORIGIN = "https://thiagollipe-web.github.io";
const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_PROMPT = 12000;
const MAX_HISTORY = 12;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "GEMINI_API_KEY não configurada no Vercel." });
  }

  try {
    const body = req.body || {};
    const prompt = String(body.prompt || "").trim();
    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];

    if (!prompt) return res.status(400).json({ error: "Prompt vazio." });
    if (prompt.length > MAX_PROMPT) return res.status(413).json({ error: "Prompt muito grande." });

    const contents = history
      .filter(item => item && ["user", "model"].includes(item.role) && Array.isArray(item.parts))
      .map(item => ({
        role: item.role,
        parts: item.parts
          .filter(part => part && typeof part.text === "string")
          .map(part => ({ text: part.text.slice(0, MAX_PROMPT) }))
      }))
      .filter(item => item.parts.length);

    contents.push({ role: "user", parts: [{ text: prompt }] });

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(GEMINI_MODEL) +
        ":generateContent",
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
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro retornado pela API Gemini."
      });
    }

    const text = Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts.map(part => part?.text || "").join("")
      : "";

    if (!text) return res.status(502).json({ error: "Gemini não retornou texto." });

    return res.status(200).json({ text, provider: "gemini", model: GEMINI_MODEL });
  } catch (error) {
    return res.status(500).json({ error: "Falha interna ao consultar o Gemini." });
  }
};
