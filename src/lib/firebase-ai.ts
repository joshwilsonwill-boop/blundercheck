// Firebase AI Logic layer (hybrid inference).
//
// Two paths, matching the hackathon brief:
// - Per-move explanations: PREFER_ON_DEVICE. Gemini Nano in Chrome answers
//   instantly on the device when it is available; the SDK falls back to the
//   cloud Gemini model when it is not. The UI shows which path actually ran.
// - Full-game review and training plan: ONLY_IN_CLOUD. Longer prompts need
//   the cloud model.
//
// Nothing here throws to the UI. If Firebase is not configured, or the model
// is unavailable, the caller gets { ok: false } and the app falls back to the
// rule-based explanations, which always work.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type GenerativeModel,
} from "firebase/ai";
import { firebaseConfig, isFirebaseConfigured, CLOUD_MODEL } from "./firebase-config";
import { initAppCheck } from "./firebase-appcheck";

export type InferencePath = "on_device" | "in_cloud" | "rule-based";

export interface AIResult {
  ok: boolean;
  text: string;
  path: InferencePath;
  reason?: string;
}

let app: FirebaseApp | null = null;
let hybridModel: GenerativeModel | null = null;
let cloudModel: GenerativeModel | null = null;
let deviceInitAttempted = false;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    // AI Logic enforcement is on: App Check must be initialised before the
    // first AI call so the SDK can exchange the debug token.
    initAppCheck(app);
  }
  return app;
}

export function getAIStatus(): "unconfigured" | "cloud-only" | "hybrid-ready" | "unavailable" {
  if (!isFirebaseConfigured) return "unconfigured";
  if (typeof window !== "undefined" && "LanguageModel" in window) return "hybrid-ready";
  return "cloud-only";
}

function getHybridModel(): GenerativeModel | null {
  const fbApp = getFirebaseApp();
  if (!fbApp) return null;
  if (!hybridModel) {
    const ai = getAI(fbApp, { backend: new GoogleAIBackend() });
    hybridModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: CLOUD_MODEL },
    });
  }
  return hybridModel;
}

function getCloudModel(): GenerativeModel | null {
  const fbApp = getFirebaseApp();
  if (!fbApp) return null;
  if (!cloudModel) {
    const ai = getAI(fbApp, { backend: new GoogleAIBackend() });
    cloudModel = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: { model: CLOUD_MODEL },
    });
  }
  return cloudModel;
}

async function warmUpDeviceModel(): Promise<void> {
  if (deviceInitAttempted) return;
  deviceInitAttempted = true;
  const model = getHybridModel();
  if (!model) return;
  try {
    // Downloads Gemini Nano on first use (Chrome desktop). If Nano is not
    // available this throws and PREFER_ON_DEVICE falls back to cloud.
    await model.initializeDeviceModel();
  } catch {
    // Fallback is automatic; nothing to do here.
  }
}

/**
 * Refine a rule-based move explanation into a short human sentence.
 * Runs on-device (Gemini Nano) when available, cloud otherwise.
 */
export async function explainMoveWithAI(ruleExplanation: string, moveSan: string): Promise<AIResult> {
  const model = getHybridModel();
  if (!model) {
    return { ok: false, text: ruleExplanation, path: "rule-based", reason: "Firebase is not configured yet" };
  }
  try {
    await warmUpDeviceModel();
    const prompt = `You are a friendly chess coach. Rewrite this engine note about the move ${moveSan} into one or two plain sentences a beginner would understand. Keep the facts exactly as written - do not invent moves or pieces. Note: ${ruleExplanation}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const path: InferencePath =
      result.response.inferenceSource === "on_device" ? "on_device" : "in_cloud";
    return { ok: true, text: text || ruleExplanation, path };
  } catch (e) {
    return {
      ok: false,
      text: ruleExplanation,
      path: "rule-based",
      reason: e instanceof Error ? e.message : "AI call failed",
    };
  }
}

/**
 * Full-game narrative review and personalised training plan.
 * Cloud only: the prompt is long and needs the full model.
 */
export async function reviewGameWithAI(gameSummary: string): Promise<AIResult> {
  const model = getCloudModel();
  if (!model) {
    return { ok: false, text: "", path: "rule-based", reason: "Firebase is not configured yet" };
  }
  try {
    const prompt = `You are a friendly chess coach writing a short post-game review for a beginner. Use plain language, no jargon without explaining it, and be encouraging but honest. Here is the game summary:\n\n${gameSummary}\n\nWrite two short sections:\n1. "What went well" - 2 to 3 sentences.\n2. "What to work on" - 3 concrete drills, one sentence each, tied to the mistakes above. Keep the whole review under 200 words.`;
    const result = await model.generateContent(prompt);
    return { ok: true, text: result.response.text().trim(), path: "in_cloud" };
  } catch (e) {
    return {
      ok: false,
      text: "",
      path: "rule-based",
      reason: e instanceof Error ? e.message : "AI call failed",
    };
  }
}
