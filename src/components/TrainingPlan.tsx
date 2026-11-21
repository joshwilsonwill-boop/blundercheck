// Training plan panel: the aggregated mistake patterns as concrete drills,
// plus the optional cloud AI review.

import type { TrainingPlan } from "../lib/training";

export interface TrainingPlanProps {
  plan: TrainingPlan;
  aiReview: string | null;
  aiLoading: boolean;
  aiAvailable: boolean;
  onRequestAiReview: () => void;
}

export default function TrainingPlanPanel({ plan, aiReview, aiLoading, aiAvailable, onRequestAiReview }: TrainingPlanProps) {
  return (
    <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">Your training plan</h3>
        <p className="text-sm text-zinc-300 leading-relaxed mt-1">{plan.headline}</p>
      </div>

      {plan.drills.length === 0 ? (
        <p className="text-sm text-zinc-400">
          Nothing to drill from this game. Play more games and the plan will grow with your weaknesses.
        </p>
      ) : (
        <ol className="space-y-3">
          {plan.drills.map((d, i) => (
            <li key={i} className="rounded-md bg-zinc-800/70 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-zinc-100 text-sm">
                  {i + 1}. {d.title}
                </span>
                <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                  {d.count} time{d.count === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-sm text-zinc-300 mt-1">{d.description}</p>
              <p className="text-sm text-amber-200/90 mt-1">
                <span className="font-semibold">Drill: </span>
                {d.practice}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="border-t border-zinc-800 pt-3">
        {aiReview ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-300">Full game review (AI)</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300">Cloud - Gemini</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-200 whitespace-pre-line">{aiReview}</p>
          </div>
        ) : (
          <button
            onClick={onRequestAiReview}
            disabled={aiLoading || !aiAvailable}
            className="text-sm font-medium rounded-md bg-amber-400 text-zinc-900 px-3 py-1.5 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {aiLoading ? "Writing your review..." : aiAvailable ? "Get the full AI game review" : "AI not configured yet"}
          </button>
        )}
      </div>
    </div>
  );
}
