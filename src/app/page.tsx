"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ChessBoard from "../components/ChessBoard";
import EvalBar from "../components/EvalBar";
import MoveList from "../components/MoveList";
import AnalysisPanel from "../components/AnalysisPanel";
import TrainingPlanPanel from "../components/TrainingPlan";
import PgnInput from "../components/PgnInput";
import HistoryPanel from "../components/HistoryPanel";
import { analyzePgn, evalToDisplay, type GameAnalysis } from "../lib/analysis";
import { explainMove } from "../lib/explain";
import { buildTrainingPlan } from "../lib/training";
import { getAIStatus, reviewGameWithAI } from "../lib/firebase-ai";
import { isFirebaseConfigured } from "../lib/firebase-config";
import { saveGame, loadHistory, type SavedGame } from "../lib/storage";
import { SAMPLE_GAMES } from "../lib/samples";

type Tab = "moves" | "coach" | "plan" | "history";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function Home() {
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("moves");
  const [flipped, setFlipped] = useState(false);
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [history, setHistory] = useState<SavedGame[]>([]);
  const [aiStatus] = useState(() => getAIStatus());

  useEffect(() => {
    loadHistory().then(setHistory).catch(() => undefined);
  }, []);

  const plan = useMemo(() => (analysis ? buildTrainingPlan(analysis.moves) : null), [analysis]);

  const selectedMove = analysis && selectedIndex >= 0 ? analysis.moves[selectedIndex] : null;
  const currentFen = selectedMove ? selectedMove.fenAfter : START_FEN;
  const currentEval = selectedMove
    ? selectedMove.evalAfter
    : analysis && analysis.moves.length > 0
      ? analysis.moves[0].evalBefore
      : 0;
  const currentMate = useMemo(() => {
    if (!analysis) return { mateIn: null as number | null, matedIn: null as number | null };
    if (!selectedMove) {
      const first = analysis.moves[0];
      if (!first) return { mateIn: null, matedIn: null };
      // At the start position, mate info comes from the first move's "before".
      return { mateIn: null, matedIn: null };
    }
    // evalAfter is white-perspective: positive mate = White mates.
    const e = selectedMove.evalAfter;
    if (e >= 29000) return { mateIn: 30000 - e, matedIn: null };
    if (e <= -29000) return { mateIn: null, matedIn: 30000 + e };
    return { mateIn: null, matedIn: null };
  }, [analysis, selectedMove]);

  const handleAnalyze = useCallback(async (pgn: string) => {
    setAnalyzing(true);
    setError(null);
    setAiReview(null);
    setProgress(0);
    setTotal(0);
    try {
      const result = await analyzePgn(pgn, {
        onProgress: (done, tot) => {
          setProgress(done);
          setTotal(tot);
        },
      });
      const withExplanations = {
        ...result,
        moves: result.moves.map((m) => ({
          ...m,
          explanation: explainMove(m, result.white, result.black),
        })),
      };
      setAnalysis(withExplanations);
      const firstBad = withExplanations.moves.findIndex(
        (m) => m.classification === "blunder" || m.classification === "mistake",
      );
      setSelectedIndex(firstBad >= 0 ? firstBad : 0);
      setTab("moves");
      const saved = await saveGame({
        white: result.white,
        black: result.black,
        result: result.result,
        moves: result.moves.length,
        blunders: result.blunders,
        mistakes: result.mistakes,
        inaccuracies: result.inaccuracies,
        accuracyWhite: result.accuracy.white,
        accuracyBlack: result.accuracy.black,
        pgn,
      });
      setHistory((h) => [saved, ...h]);
    } catch (e) {
      setError(e instanceof Error ? `Could not analyse that PGN: ${e.message}` : "Could not analyse that PGN.");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  async function handleAiReview() {
    if (!analysis) return;
    setAiReviewLoading(true);
    const worst = analysis.moves
      .filter((m) => m.classification === "blunder" || m.classification === "mistake")
      .slice(0, 5)
      .map((m) => `Move ${m.ply} ${m.san} (${m.classification}): ${m.explanation}`)
      .join("\n");
    const summary = `Game: ${analysis.white} (White, accuracy ${analysis.accuracy.white}%) vs ${analysis.black} (Black, accuracy ${analysis.accuracy.black}%), result ${analysis.result}. ${analysis.moves.length} moves. Blunders: ${analysis.blunders}, mistakes: ${analysis.mistakes}, inaccuracies: ${analysis.inaccuracies}. Training plan: ${plan ? plan.headline : ""}\n\nWorst moves:\n${worst || "No major mistakes."}`;
    const res = await reviewGameWithAI(summary);
    setAiReviewLoading(false);
    if (res.ok) setAiReview(res.text);
  }

  const aiBadge = {
    unconfigured: { text: "AI: not configured - rule-based coaching", cls: "bg-zinc-700 text-zinc-300" },
    "cloud-only": { text: "AI: cloud Gemini ready", cls: "bg-sky-500/20 text-sky-300" },
    "hybrid-ready": { text: "AI: on-device Nano ready", cls: "bg-emerald-500/20 text-emerald-300" },
    unavailable: { text: "AI: unavailable", cls: "bg-zinc-700 text-zinc-300" },
  }[aiStatus];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="text-amber-400">Blunder</span>Check
            </h1>
            <p className="text-sm text-zinc-400">A chess coach that explains your mistakes like a human.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${aiBadge.cls}`}>{aiBadge.text}</span>
            <a
              href="https://github.com/joshwilsonwill-boop/blundercheck"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PgnInput onAnalyze={handleAnalyze} analyzing={analyzing} progress={progress} total={total} />
        {error && <p className="rounded-md bg-red-500/10 text-red-300 text-sm px-4 py-3 ring-1 ring-red-500/30">{error}</p>}

        {analysis && (
          <>
            <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="font-semibold text-zinc-100">
                {analysis.white} vs {analysis.black}
              </span>
              <span className="text-zinc-400">Result: {analysis.result}</span>
              <span>
                Accuracy <span className="font-semibold text-zinc-100">{analysis.accuracy.white}%</span> /{" "}
                <span className="font-semibold text-zinc-100">{analysis.accuracy.black}%</span>
              </span>
              <span className="text-red-300 font-medium">{analysis.blunders} blunders</span>
              <span className="text-orange-300">{analysis.mistakes} mistakes</span>
              <span className="text-yellow-300">{analysis.inaccuracies} inaccuracies</span>
              <span className="text-emerald-300">{analysis.bestMoves} best moves</span>
            </div>

            <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
              <div className="space-y-3">
                <div className="flex gap-4 items-stretch justify-center">
                  <EvalBar evalWhite={currentEval} mateInWhite={currentMate.mateIn} matedInWhite={currentMate.matedIn} />
                  <ChessBoard
                    fen={currentFen}
                    flipped={flipped}
                    lastMove={
                      selectedMove ? { from: selectedMove.uci.slice(0, 2), to: selectedMove.uci.slice(2, 4) } : null
                    }
                  />
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button
                    onClick={() => setSelectedIndex((i) => Math.max(-1, i - 1))}
                    disabled={selectedIndex <= -1}
                    className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setSelectedIndex((i) => Math.min(analysis.moves.length - 1, i + 1))}
                    disabled={selectedIndex >= analysis.moves.length - 1}
                    className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setFlipped((f) => !f)}
                    className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700"
                  >
                    Flip board
                  </button>
                  <button
                    onClick={() => {
                      const firstBad = analysis.moves.findIndex(
                        (m) => m.classification === "blunder" || m.classification === "mistake",
                      );
                      if (firstBad >= 0) setSelectedIndex(firstBad);
                    }}
                    className="rounded-md bg-amber-400 text-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-amber-300"
                  >
                    First blunder
                  </button>
                </div>
                <p className="text-center text-xs text-zinc-500">
                  Eval {evalToDisplay(currentEval, currentMate.mateIn, currentMate.matedIn)} from White's perspective.
                  Analysis runs locally in your browser with a port of the tiny-chess engine.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-1 rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-1">
                  {(["moves", "coach", "plan", "history"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium capitalize ${
                        tab === t ? "bg-amber-400 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {t === "coach" ? "Coach" : t}
                    </button>
                  ))}
                </div>
                {tab === "moves" && <MoveList moves={analysis.moves} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />}
                {tab === "coach" && (
                  <AnalysisPanel
                    key={selectedIndex}
                    move={selectedMove}
                    whiteName={analysis.white}
                    blackName={analysis.black}
                    aiAvailable={isFirebaseConfigured}
                  />
                )}
                {tab === "plan" && plan && (
                  <TrainingPlanPanel
                    plan={plan}
                    aiReview={aiReview}
                    aiLoading={aiReviewLoading}
                    aiAvailable={isFirebaseConfigured}
                    onRequestAiReview={handleAiReview}
                  />
                )}
                {tab === "history" && <HistoryPanel history={history} onLoadPgn={handleAnalyze} />}
              </div>
            </div>
          </>
        )}

        {!analysis && (
          <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-5">
            <h2 className="font-semibold text-zinc-100">How it works</h2>
            <ol className="list-decimal list-inside text-sm text-zinc-300 space-y-1 mt-2">
              <li>Paste a PGN from any game you played, or load a sample game.</li>
              <li>The engine analyses every position locally in your browser - no server, no cost, no waiting on a queue.</li>
              <li>Every move is classified: best, good, inaccuracy, mistake or blunder, with the eval swing in pawns.</li>
              <li>The coach explains each flagged move in plain language: what was hanging, what the tactic was, what to play instead.</li>
              <li>Your repeated mistakes become a training plan with concrete drills, and your blunder rate is tracked over time.</li>
            </ol>
            <p className="text-sm text-zinc-400 mt-3">
              The AI layer uses Firebase AI Logic: Gemini Nano answers on your device when it is available, and Gemini in the
              cloud handles the full-game review. Analysis itself never needs the cloud.
            </p>
            <div className="grid sm:grid-cols-3 gap-2 mt-4">
              {SAMPLE_GAMES.map((g) => (
                <div key={g.id} className="rounded-md bg-zinc-800/70 p-3">
                  <span className="block text-sm font-semibold text-zinc-100">{g.title}</span>
                  <span className="block text-xs text-zinc-400 mt-0.5">{g.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>BlunderCheck - built for #BuildHybridAI 2026. Engine: a TypeScript port of the tiny-chess engine.</span>
          <span>Analysis runs locally. Your games stay yours.</span>
        </div>
      </footer>
    </div>
  );
}
