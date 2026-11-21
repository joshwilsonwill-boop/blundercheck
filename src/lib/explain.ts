// Plain-language explanations for every flagged move, generated from the
// engine data. No AI needed for this layer: the engine already knows what was
// hanging, what the best move was, and how much the move cost. The AI layer
// (Firebase AI Logic) refines these drafts; it never replaces the facts.

import type { AnalyzedMove } from "./analysis";

function pawns(cp: number): string {
  const p = cp / 100;
  return p.toFixed(p % 1 === 0 ? 0 : 1);
}

export function explainMove(m: AnalyzedMove, moverName: string, opponentName: string): string {
  const lossPawns = pawns(m.loss);

  // Delivered checkmate.
  if (m.isMate) {
    return `Checkmate. ${m.san} ends the game on the spot - nothing ${opponentName} does can stop it.`;
  }

  // Had a forced mate and let it go.
  if (m.mateBefore !== null && m.classification === "blunder") {
    return `You had mate in ${m.mateBefore} with ${m.bestSan}, and ${m.san} lets it slip away. When you see a forced mate, play it first and ask questions later - the win only gets harder from here.`;
  }

  // Walked into a mate.
  if (m.mateAfter !== null) {
    return `${m.san} walks into a forced mate in ${m.mateAfter} for ${opponentName}. The king is out of squares after this move - look for the escape route before you commit to an attack.`;
  }

  // Left a piece hanging.
  if (m.hanging.length > 0) {
    const h = m.hanging[0];
    const extra = m.hanging.length > 1 ? ` You also left ${m.hanging.length - 1} more piece${m.hanging.length > 2 ? "s" : ""} loose.` : "";
    return `${m.san} leaves your ${h.piece} on ${h.square} hanging - ${opponentName} can take it for free with the ${h.attacker}.${extra} Before every move, ask: what is my opponent threatening, and what did my last move leave undefended?`;
  }

  // Missed a free capture.
  if (m.missedCapture) {
    return `${m.san} misses a free ${m.missedCapture}. The engine's choice, ${m.bestSan}, simply takes it. Train your eye to scan for loose pieces on every move - if it is undefended, it is yours.`;
  }

  // Blunder or mistake with a clear better move.
  if (m.classification === "blunder" || m.classification === "mistake") {
    return `${m.san} gives away about ${lossPawns} pawns of advantage. The better move was ${m.bestSan}. The position was ${m.evalBefore >= 0 ? "better" : "worse"} for you before this move - slow down here and compare your candidate moves before you play one.`;
  }

  // Inaccuracy.
  if (m.classification === "inaccuracy") {
    return `${m.san} is a small slip - it costs about ${lossPawns} pawns. ${m.bestSan} was a touch more accurate. Small slips add up, so this is the kind of move to review, not to worry about.`;
  }

  // Best move.
  if (m.classification === "best") {
    if (m.matedAfter !== null && m.matedAfter > 0) {
      return `${m.san} is the best move - it forces mate in ${m.matedAfter}. Clean, forcing play.`;
    }
    return `${m.san} is the engine's top choice. Well played - this keeps the pressure on.`;
  }

  // Good move.
  return `${m.san} is solid and keeps the game on track.`;
}

export function explainMoveShort(m: AnalyzedMove): string {
  switch (m.classification) {
    case "blunder":
      if (m.mateBefore !== null) return `Missed mate in ${m.mateBefore}`;
      if (m.hanging.length > 0) return `Hung the ${m.hanging[0].piece} on ${m.hanging[0].square}`;
      if (m.mateAfter !== null) return `Walked into mate in ${m.mateAfter}`;
      return `Blunder, lost ${pawns(m.loss)} pawns`;
    case "mistake":
      if (m.missedCapture) return `Missed a free ${m.missedCapture}`;
      return `Mistake, lost ${pawns(m.loss)} pawns`;
    case "inaccuracy":
      return `Inaccuracy, lost ${pawns(m.loss)} pawns`;
    case "best":
      if (m.isMate) return "Checkmate";
      if (m.matedAfter !== null) return `Forces mate in ${m.matedAfter}`;
      return "Best move";
    default:
      return "Good move";
  }
}
