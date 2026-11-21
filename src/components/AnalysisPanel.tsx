// Coach panel: the plain-language explanation for the selected move, the
// engine's better move, and the optional AI refinement (on-device first).

import { useState } from "react";
import type { AnalyzedMove } from "../lib/analysis";
import { explainMove, explainMoveShort } from "../lib/explain";
import { explainMoveWithAI, type InferencePath } from "../lib/firebase-ai";

const CLASS_LABEL: Record<string, { text: string; classes: string }> = {
  best: { text: "Best move", classes: "bg-emerald-500/20 text-emerald-300" },
  good: { text: "Good move", classes: "bg-zinc-700/60 text-zinc-200" },
  inaccuracy: { text: "Inaccuracy", classes: "bg-yellow-500/20 text-yellow-300" },
  mistake: { text: "Mistake", classes: "bg-orange-500/20 text-orange-300" },
  blunder: { text: "Blunder", classes: "bg-red-500/25 text-red-300" },
};

export interface AnalysisPanelProps {
  move: AnalyzedMove | null;
  whiteName: string;
  blackName: string;
  aiAvailable: boolean;
}

export default function AnalysisPanel({ move, whiteName, blackName, aiAvailable }: AnalysisPanelProps) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiPath, setAiPath] = useState<InferencePath | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  if (!move) {
    return (
      <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-4 text-sm text-zinc-400">
        Select a move to see the coach's notes on it. Blunders and mistakes are marked in the move list.
      </div>
    );
  }

  // Capture after the null guard so closures see a non-null move.
  const currentMove = move;
  const moverName = currentMove.color === "w" ? whiteName : blackName;
  const opponentName = currentMove.color === "w" ? blackName : whiteName;
  const ruleText = explainMove(currentMove, moverName, opponentName);
  const label = CLASS_LABEL[currentMove.classification];

  async function handleAiExplain() {
    setAiLoading(true);
    setAiNote(null);
    const res = await explainMoveWithAI(ruleText, currentMove.san);
    setAiLoading(false);
    if (res.ok) {
      setAiText(res.text);
      setAiPath(res.path);
    } else {
      setAiNote(res.reason || "AI is unavailable right now - the note above is the full explanation.");
    }
  }

  return (
    <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg font-bold text-zinc-100">
          {move.ply}. {move.san}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${label.classes}`}>{label.text}</span>
        <span className="text-xs text-zinc-400">{explainMoveShort(move)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded bg-zinc-800/70 py-2">
          <div className="text-[11px] text-zinc-500">Eval before</div>
          <div className="font-mono font-semibold text-zinc-100">
            {(move.evalBefore / 100 >= 0 ? "+" : "") + (move.evalBefore / 100).toFixed(1)}
          </div>
        </div>
        <div className="rounded bg-zinc-800/70 py-2">
          <div className="text-[11px] text-zinc-500">Eval after</div>
          <div className="font-mono font-semibold text-zinc-100">
            {(move.evalAfter / 100 >= 0 ? "+" : "") + (move.evalAfter / 100).toFixed(1)}
          </div>
        </div>
        <div className="rounded bg-zinc-800/70 py-2">
          <div className="text-[11px] text-zinc-500">Lost</div>
          <div className="font-mono font-semibold text-red-300">{(move.loss / 100).toFixed(1)} pawns</div>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-zinc-200">{ruleText}</p>

      {move.bestSan && move.bestSan !== move.san && (
        <p className="text-sm text-zinc-300">
          <span className="font-semibold text-emerald-300">Engine choice: </span>
          {move.bestSan}
          {move.mateBefore !== null ? ` (mate in ${move.mateBefore})` : ""}
        </p>
      )}
      {move.hanging.length > 0 && (
        <p className="text-sm text-zinc-300">
          <span className="font-semibold text-red-300">Left hanging: </span>
          {move.hanging.map((h) => `${h.piece} on ${h.square}`).join(", ")}
        </p>
      )}

      <div className="border-t border-zinc-800 pt-3">
        {aiText ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-300">Coach (AI)</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  aiPath === "on_device" ? "bg-emerald-500/20 text-emerald-300" : "bg-sky-500/20 text-sky-300"
                }`}
              >
                {aiPath === "on_device" ? "On device - Gemini Nano" : "Cloud - Gemini"}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-200">{aiText}</p>
          </div>
        ) : (
          <button
            onClick={handleAiExplain}
            disabled={aiLoading || !aiAvailable}
            className="text-sm font-medium rounded-md bg-amber-400 text-zinc-900 px-3 py-1.5 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {aiLoading ? "Asking the coach..." : aiAvailable ? "Explain this like a human (AI)" : "AI not configured yet"}
          </button>
        )}
        {aiNote && <p className="text-xs text-zinc-500 mt-2">{aiNote}</p>}
      </div>
    </div>
  );
}
