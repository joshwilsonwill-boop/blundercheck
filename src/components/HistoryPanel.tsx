// Progress history: saved analysed games and the blunder rate over time.
// Loads from Firestore when configured, otherwise from local storage.

import type { SavedGame } from "../lib/storage";
import { averageBlunders } from "../lib/storage";

export interface HistoryPanelProps {
  history: SavedGame[];
  onLoadPgn: (pgn: string) => void;
}

export default function HistoryPanel({ history, onLoadPgn }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-4 text-sm text-zinc-400">
        No games saved yet. Analyse a game and it will be saved here automatically, so you can watch your blunder rate fall over time.
      </div>
    );
  }
  const avg = averageBlunders(history);
  const maxBlunders = Math.max(1, ...history.map((g) => g.blunders));
  return (
    <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Your progress</h3>
        <span className="text-xs text-zinc-400">
          {history.length} game{history.length === 1 ? "" : "s"} - avg {avg.toFixed(1)} blunders per game
        </span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {[...history].reverse().map((g) => (
          <div
            key={g.id}
            title={`${g.white} vs ${g.black} - ${g.blunders} blunders`}
            className="flex-1 rounded-t bg-amber-400/80 min-w-[6px]"
            style={{ height: `${Math.max(8, (g.blunders / maxBlunders) * 100)}%` }}
          />
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">Blunders per game, oldest to newest. Lower is better.</p>
      <ul className="divide-y divide-zinc-800 text-sm">
        {history.slice(0, 10).map((g) => (
          <li key={g.id} className="py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-zinc-100 truncate block">
                {g.white} vs {g.black}
              </span>
              <span className="text-xs text-zinc-500">
                {g.date.slice(0, 10)} - {g.result} - {g.moves} moves - {g.blunders} blunders, {g.mistakes} mistakes
              </span>
            </div>
            {g.pgn && (
              <button
                onClick={() => onLoadPgn(g.pgn as string)}
                className="shrink-0 text-xs font-medium rounded bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
              >
                Re-analyse
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
