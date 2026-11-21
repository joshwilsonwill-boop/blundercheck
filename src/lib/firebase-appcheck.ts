// Firebase App Check (debug provider).
//
// AI Logic enforcement is ON for this project, so every AI call must carry a
// valid App Check token. The hackathon accepts debug tokens, so the app runs
// in App Check debug mode with the token registered in the console
// (App Check > Apps > blundercheck-web > Manage debug tokens).
//
// How it works: setting self.FIREBASE_APPCHECK_DEBUG_TOKEN before
// initializeAppCheck makes the SDK exchange that token directly and never
// call the attestation provider (verified in the installed SDK source,
// @firebase/app-check: getToken short-circuits to the debug exchange).
// The CustomProvider below is therefore never invoked; it only satisfies
// the initializeAppCheck signature.
//
// Note for later: a debug token bypasses attestation, so anyone holding it
// can call this project's AI Logic API as this app and burn free quota.
// That is acceptable for a hackathon demo (the brief explicitly accepts
// debug tokens), but before this app ever goes beyond the hackathon, swap
// this for a reCAPTCHA v3 provider with a site key and delete the debug
// token from the console.

import { initializeAppCheck, CustomProvider } from "firebase/app-check";
import type { FirebaseApp } from "firebase/app";

/** Registered in the Firebase console for blundercheck-web. */
export const APP_CHECK_DEBUG_TOKEN = "fc05eb66-6ef8-4eb5-b5a1-9822e907f437";

let initialized = false;

/** Call once, in the browser, right after initializeApp. Safe to call repeatedly. */
export function initAppCheck(app: FirebaseApp): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    APP_CHECK_DEBUG_TOKEN;
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: () => {
        throw new Error("App Check is in debug mode; the attestation provider is never called.");
      },
    }),
    isTokenAutoRefreshEnabled: true,
  });
}
