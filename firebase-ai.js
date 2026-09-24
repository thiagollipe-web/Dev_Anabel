import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";

const config = window.ANABEL_FIREBASE_CONFIG || {};
const siteKey = String(window.ANABEL_FIREBASE_APPCHECK_SITE_KEY || "").trim();
const modelName = String(window.ANABEL_FIREBASE_MODEL || "gemini-2.5-flash").trim();

function hasConfig(value) {
  return ["apiKey","authDomain","projectId","storageBucket","messagingSenderId","appId"]
    .every(key => typeof value[key] === "string" && value[key].trim());
}

let model = null;
let initError = null;

async function initialize() {
  if (!hasConfig(config)) return false;

  try {
    const app = initializeApp(config);

    if (siteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
    }

    const ai = getAI(app, { backend: new GoogleAIBackend() });
    model = getGenerativeModel(ai, { model: modelName });
    return true;
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    return false;
  }
}

const ready = initialize();
window.AnabelFirebaseReady = ready;

window.AnabelFirebaseAI = {
  configured: hasConfig(config),
  async generate(prompt, history = []) {
    const active = await ready;
    if (!active || !model) {
      throw new Error(initError || "Firebase AI Logic ainda não está configurado.");
    }

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-10)
          .map(item => ({
            role: item?.role === "model" ? "model" : "user",
            parts: Array.isArray(item?.parts)
              ? item.parts.filter(part => part && typeof part.text === "string")
              : []
          }))
          .filter(item => item.parts.length)
      : [];

    const chat = model.startChat({
      history: safeHistory,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 2048
      }
    });

    const result = await chat.sendMessage(String(prompt).slice(0, 12000));
    const text = result?.response?.text?.();

    if (!text) throw new Error("Gemini não retornou texto.");
    return { text, provider: "firebase-gemini", model: modelName };
  }
};

if (hasConfig(config)) {
  ready.then(ok => {
    if (ok) console.info("ANABEL: Firebase AI Logic pronto.");
    else console.warn("ANABEL: Firebase AI Logic não inicializado:", initError || "configuração incompleta");
  });
}
