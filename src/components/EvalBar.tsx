// Vertical evaluation bar. White's share of the bar comes from the standard
// win-probability curve; mate scores fill the bar completely.

import { evalToWinPercent, evalToDisplay } from "../lib/analysis";

export interface EvalBarProps {
  evalWhite: number;
  mateInWhite: number | null;
  matedInWhite: number | null;
}

export default function EvalBar({ evalWhite, mateInWhite, matedInWhite }: EvalBarProps) {
  const whiteShare = mateInWhite !== null ? 1 : matedInWhite !== null ? 0 : evalToWinPercent(evalWhite);
  const label = evalToDisplay(evalWhite, mateInWhite, matedInWhite);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-mono text-zinc-300 bg-zinc-800 rounded px-1.5 py-0.5">{label}</span>
      <div className="relative w-4 flex-1 min-h-[280px] rounded overflow-hidden ring-1 ring-zinc-700 bg-zinc-900">
        <div className="absolute inset-x-0 bottom-0 bg-zinc-100 transition-all duration-300" style={{ height: `${whiteShare * 100}%` }} />
        <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-500/60" />
      </div>
      <span className="text-[10px] text-zinc-500">eval</span>
    </div>
  );
}
