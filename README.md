# BlunderCheck

A chess coach that explains your mistakes like a human. Paste a PGN game and get every blunder explained in plain language, plus a training plan built from your actual weaknesses.

Built for [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com) - a generative AI web app using Firebase AI Logic, with on-device inference (Gemini Nano) when available and cloud fallback (Gemini) when it is not.

Repo: https://github.com/joshwilsonwill-boop/blundercheck

## What it does

1. **Paste a PGN** - paste a game, upload a .pgn file, or load one of three built-in sample games (Fool's Mate, Scholar's Mate, the Immortal Game).
2. **Engine analysis, locally** - every position is evaluated in your browser by a TypeScript port of the tiny-chess engine (0x88 board, alpha-beta + quiescence, MVV-LVA ordering, iterative deepening on a fixed node budget). No server, no cost, no queue.
3. **Plain-language coaching** - every move is classified (best / good / inaccuracy / mistake / blunder) with the eval swing in pawns. The coach tells you what was hanging, what the tactic was, and what to play instead.
4. **Training plan** - your repeated mistakes become concrete drills (stop hanging pieces, finish the game when you can, take the free pieces, king safety first).
5. **Progress tracking** - analysed games are saved and your blunder rate over time is charted.

## The hybrid AI story

Two AI paths, both through Firebase AI Logic:

- **Per-move explanations - on-device first.** The quick "explain this move" call uses `InferenceMode.PREFER_ON_DEVICE`: Gemini Nano in Chrome answers instantly on your device when it is available, and the SDK falls back to cloud Gemini when it is not. The UI shows which path actually ran ("On device - Gemini Nano" vs "Cloud - Gemini").
- **Full-game review - cloud.** The longer narrative review and personalised training plan use `InferenceMode.ONLY_IN_CLOUD` with Gemini.

The rule-based coach always works, with or without AI. The AI refines the explanation; it never replaces the engine facts.

## The engine

`src/lib/engine.ts` is a faithful TypeScript port of [tiny-chess](https://github.com/joshwilsonwill-boop/tiny-chess), the 4,068-byte Python engine Joshua built for the make.fun tiny-chess-01 bounty (0x88 board, alpha-beta + quiescence, material + pawn piece-square table, iterative deepening on an 80,000-node budget, deterministic). The port keeps the same values, the same pawn table, the same search shape. One addition: mate scores carry distance, so analysis can say "mate in 2" instead of just "mate". No Stockfish code, no GPL code.

## How to run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and paste a PGN.

To verify the analysis headlessly (runs the engine over all three sample games and prints the numbers):

```bash
npm run verify
```

To build for production:

```bash
npm run build
npm run start
```

## Firebase setup

The app works fully without Firebase (rule-based coaching + local storage). To enable the AI layer:

1. Create a Firebase project in the [Firebase console](https://console.firebase.google.com).
2. Enable AI Logic (Gemini Developer API) and register a web app.
3. Copy the web app config into `src/lib/firebase-config.ts` (replace the `YOUR_*` placeholders) and set `isFirebaseConfigured` will flip on automatically once real values are present.
4. For the on-device path, use Chrome 139+ on desktop with the Prompt API flag enabled (`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`).

Firebase web config values are public by design and safe to ship in client code. No API keys or secrets are stored in this repo.

## Screenshots

Screenshots coming soon - the app is in active development.

- Board + eval bar + move list: _to be added_
- Coach panel with a blunder explanation: _to be added_
- Training plan: _to be added_

## License

Apache-2.0. See [LICENSE](LICENSE).
