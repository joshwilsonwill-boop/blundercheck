// Move list with per-move classification colours. Click a move to jump the
// board to that position.

import type { AnalyzedMove, Classification } from "../lib/analysis";

const CLASS_STYLES: Record<Classification, string> = {
  best: "bg-emerald-500/20 text-emerald-300 font-semibold",
  good: "text-zinc-200 hover:bg-zinc-800",
  inaccuracy: "bg-yellow-500/15 text-yellow-300",
  mistake: "bg-orange-500/20 text-orange-300 font-medium",
  blunder: "bg-red-500/25 text-red-300 font-semibold",
};

const CLASS_MARK: Record<Classification, string> = {
  best: "!!",
  good: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

export interface MoveListProps {
  moves: AnalyzedMove[];
  selectedIndex: number; // -1 = start position
  onSelect: (index: number) => void;
}

export default function MoveList({ moves, selectedIndex, onSelect }: MoveListProps) {
  const pairs: Array<{ num: number; white?: AnalyzedMove; black?: AnalyzedMove }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ num: i / 2 + 1, white: moves[i], black: moves[i + 1] });
  }
  return (
    <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-200">Moves</span>
        <span className="text-[11px] text-zinc-500">
          <span className="text-emerald-400 font-semibold">!!</span> best{" "}
          <span className="text-yellow-400">?!</span> inaccuracy{" "}
          <span className="text-orange-400">?</span> mistake{" "}
          <span className="text-red-400 font-semibold">??</span> blunder
        </span>
      </div>
      <div className="max-h-[320px] overflow-y-auto p-1">
        {pairs.map((pair) => (
          <div key={pair.num} className="grid grid-cols-[2.5rem_1fr_1fr] items-center text-sm">
            <span className="text-zinc-500 text-center py-1">{pair.num}.</span>
            {[pair.white, pair.black].map((m, j) =>
              m ? (
                <button
                  key={j}
                  onClick={() => onSelect(m.index)}
                  className={`text-left px-2 py-1 rounded mx-0.5 ${CLASS_STYLES[m.classification]} ${
                    selectedIndex === m.index ? "ring-2 ring-amber-400" : ""
                  }`}
                  title={m.classification}
                >
                  {m.san}
                  {CLASS_MARK[m.classification] && (
                    <span className="ml-0.5 text-[11px]">{CLASS_MARK[m.classification]}</span>
                  )}
                </button>
              ) : (
                <span key={j} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
