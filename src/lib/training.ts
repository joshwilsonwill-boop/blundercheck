// Training plan: aggregate the game's repeated mistake patterns into a short
// plan with concrete drills. Built from the analysis data only - no AI needed
// for the structure; the AI layer adds a personalised write-up on top.

import type { AnalyzedMove } from "./analysis";

export interface Drill {
  title: string;
  count: number;
  pattern: string;
  description: string;
  practice: string;
}

export interface TrainingPlan {
  headline: string;
  drills: Drill[];
  totalFlagged: number;
}

const DRILL_LIBRARY: Record<string, { title: string; description: string; practice: string }> = {
  "hanging-piece": {
    title: "Stop hanging pieces",
    description:
      "You left pieces undefended and your opponent collected them. This is the single most common way games are lost below master level.",
    practice:
      "Before every move, ask two questions: what is my opponent threatening, and what did my last move leave undefended? Do 10 tactics puzzles a day focused on loose pieces.",
  },
  "missed-mate": {
    title: "Finish the game when you can",
    description:
      "You had forced mates on the board and played past them. A win in hand is worth more than a prettier attack.",
    practice:
      "Do 10 mate-in-2 puzzles a day. When you are up material, slow down and scan for checks, captures and threats in that order.",
  },
  "missed-capture": {
    title: "Take the free pieces",
    description:
      "Your opponent left pieces loose and you walked past them. Free material wins games.",
    practice:
      "After your opponent moves, scan every one of their pieces and ask: is it defended? If not, take it. Drill this with 10 puzzles a day on undefended pieces.",
  },
  "walked-into-mate": {
    title: "King safety first",
    description:
      "Your king got caught in the open. Attacks are fun, but a dead king ends the game.",
    practice:
      "Castle early, keep a pawn shield in front of your king, and never move a pawn in front of a castled king without checking what opens up. Review one master game a week and watch how they keep the king safe.",
  },
  "opening-blunder": {
    title: "Opening discipline",
    description:
      "Big mistakes early cost you the game before it started. The opening is about safety and development, not tricks.",
    practice:
      "Learn one solid opening for White and one for Black. Follow the opening principles: develop, castle, connect the rooks, then attack.",
  },
  tactics: {
    title: "Sharpen your tactics",
    description:
      "Several moves missed tactical ideas - forks, pins and discovered attacks that change the evaluation fast.",
    practice:
      "Do 15 tactics puzzles a day, mixed themes. Focus on spotting forks and pins in your own games after you play them.",
  },
};

export function buildTrainingPlan(moves: AnalyzedMove[]): TrainingPlan {
  const counts: Record<string, number> = {};
  for (const m of moves) {
    for (const tag of m.patternTags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  const totalFlagged = moves.filter(
    (m) => m.classification === "blunder" || m.classification === "mistake" || m.classification === "inaccuracy",
  ).length;

  // Rank patterns by frequency; "tactics" is a catch-all, so it only appears
  // when nothing more specific does.
  const ranked = Object.entries(counts)
    .filter(([tag]) => tag !== "tactics" && tag !== "delivering-mate")
    .sort((a, b) => b[1] - a[1]);
  const drills: Drill[] = ranked.slice(0, 4).map(([tag, count]) => {
    const lib = DRILL_LIBRARY[tag] || DRILL_LIBRARY.tactics;
    return { title: lib.title, count, pattern: tag, description: lib.description, practice: lib.practice };
  });
  if (drills.length < 3 && counts["tactics"]) {
    drills.push({
      title: DRILL_LIBRARY.tactics.title,
      count: counts["tactics"],
      pattern: "tactics",
      description: DRILL_LIBRARY.tactics.description,
      practice: DRILL_LIBRARY.tactics.practice,
    });
  }

  let headline: string;
  if (totalFlagged === 0) {
    headline = "A clean game - no blunders, mistakes or inaccuracies found. Keep playing at this level and the rating will follow.";
  } else if (drills.length > 0) {
    headline = `${totalFlagged} flagged move${totalFlagged === 1 ? "" : "s"} in this game. The biggest leak is ${drills[0].title.toLowerCase()} (${drills[0].count} time${drills[0].count === 1 ? "" : "s"}) - fix that first.`;
  } else {
    headline = `${totalFlagged} flagged move${totalFlagged === 1 ? "" : "s"} in this game. Work through the notes on each one below.`;
  }

  return { headline, drills: drills.slice(0, 5), totalFlagged };
}
