// Game analysis: parse a PGN with chess.js, evaluate every position with the
// ported tiny-chess engine, and classify every move by how much advantage it
// threw away. All scores are centipawns from White's perspective unless noted.

import { Chess } from "chess.js";
import {
  TinyEngine,
  moveToUci,
  squareName,
  pieceName,
  MATE_SCORE,
  MATE_THRESHOLD,
} from "./engine";

export type Classification = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface HangingPiece {
  piece: string;
  square: string;
  attacker: string;
}

export interface AnalyzedMove {
  index: number;
  ply: number;
  san: string;
  uci: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
  evalBefore: number; // white perspective, centipawns
  evalAfter: number;
  bestUci: string;
  bestSan: string;
  loss: number; // centipawns the mover gave away
  classification: Classification;
  mateBefore: number | null; // mover had a forced mate in N
  mateAfter: number | null; // opponent has a forced mate in N after this move
  matedAfter: number | null; // mover is mated in N after this move
  hanging: HangingPiece[];
  missedCapture: string | null; // piece the best move would have won
  isCheck: boolean;
  isMate: boolean;
  explanation: string;
  patternTags: string[];
}

export interface GameAnalysis {
  headers: Record<string, string>;
  white: string;
  black: string;
  result: string;
  moves: AnalyzedMove[];
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  bestMoves: number;
  accuracy: { white: number; black: number };
  finalEval: number;
}

export interface AnalysisOptions {
  nodeBudget?: number;
  maxDepth?: number;
  onProgress?: (done: number, total: number) => void;
}

const PIECE_VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

export function evalToDisplay(evalCp: number, mateInWhite: number | null, matedInWhite: number | null): string {
  if (mateInWhite !== null) return "M" + mateInWhite;
  if (matedInWhite !== null) return "-M" + matedInWhite;
  const pawns = evalCp / 100;
  return (pawns >= 0 ? "+" : "") + pawns.toFixed(1);
}

export function evalToWinPercent(evalCp: number): number {
  return 1 / (1 + Math.exp(-0.00368208 * evalCp));
}

function moverValue(evalWhite: number, color: "w" | "b"): number {
  return color === "w" ? evalWhite : -evalWhite;
}

export async function analyzePgn(pgn: string, opts: AnalysisOptions = {}): Promise<GameAnalysis> {
  const nodeBudget = opts.nodeBudget ?? 20000;
  const maxDepth = opts.maxDepth ?? 5;
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  if (history.length === 0) throw new Error("No moves found in PGN");
  const headers = game.header() as Record<string, string>;

  // Positions: start position plus the position after every move.
  const fens: string[] = [new Chess().fen(), ...history.map((m) => m.after)];

  const engine = new TinyEngine();
  interface PosEval {
    evalWhite: number;
    bestUci: string;
    mateInStm: number | null;
    matedInStm: number | null;
  }
  const evals: PosEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    engine.loadFen(fens[i]);
    const res = engine.bestMove(nodeBudget, maxDepth);
    const stmScore = res.score;
    const evalWhite = engine.turn === 0 ? stmScore : -stmScore;
    evals.push({
      evalWhite,
      bestUci: res.uci,
      mateInStm: res.mateIn,
      matedInStm: res.matedIn,
    });
    opts.onProgress?.(i + 1, fens.length);
    // Yield so the UI stays responsive during a long analysis.
    await new Promise((r) => setTimeout(r, 0));
  }

  const moves: AnalyzedMove[] = [];
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;
  let bestMoves = 0;
  let whiteLoss = 0;
  let blackLoss = 0;
  let whiteMoves = 0;
  let blackMoves = 0;

  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    const color = h.color as "w" | "b";
    const before = evals[i];
    const after = evals[i + 1];
    const playedIsBest =
      h.from + h.to + (h.promotion || "") === before.bestUci.slice(0, 4) + (before.bestUci[4] || "");
    // The engine's own best move can never be a blunder: any loss shown is
    // eval noise between the two positions' search depths, so report zero.
    const loss = playedIsBest ? 0 : Math.max(0, moverValue(before.evalWhite, color) - moverValue(after.evalWhite, color));

    // Best move SAN: look it up in the legal moves of the position before.
    let bestSan = "";
    let missedCapture: string | null = null;
    {
      const probe = new Chess(fens[i]);
      const legal = probe.moves({ verbose: true });
      const match = legal.find(
        (m) => m.from === before.bestUci.slice(0, 2) && m.to === before.bestUci.slice(2, 4) && (m.promotion || "") === (before.bestUci[4] || ""),
      );
      bestSan = match ? match.san : before.bestUci;
      if (match && match.captured && PIECE_VALUES[match.captured] >= 300) {
        const playedCapture = h.captured ? PIECE_VALUES[h.captured] : 0;
        if (playedCapture < PIECE_VALUES[match.captured]) {
          missedCapture = pieceName({ p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 }[match.captured]);
        }
      }
    }

    // Hanging pieces the mover left behind (checked in the position after).
    const hanging: HangingPiece[] = [];
    {
      engine.loadFen(fens[i + 1]);
      const moverColor = color === "w" ? 0 : 1;
      for (const hp of engine.hangingPieces(moverColor as 0 | 1)) {
        const attackerSq = hp.attackerSquares[0];
        const attackerPiece = engine.board[attackerSq];
        hanging.push({
          piece: pieceName(hp.pieceType),
          square: squareName(hp.square),
          attacker: pieceName(attackerPiece & 7) + " on " + squareName(attackerSq),
        });
      }
    }

    const mateBefore = before.mateInStm;
    // After the move it is the opponent's turn. mateAfter = opponent has a
    // forced mate in N (the mover walked into it). matedAfter = opponent is
    // mated in N (the mover is delivering mate in N).
    const mateAfter = after.mateInStm;
    const matedAfter = after.matedInStm;

    const deliveredMate =
      (color === "w" && after.evalWhite >= MATE_THRESHOLD) ||
      (color === "b" && after.evalWhite <= -MATE_THRESHOLD);
    let classification: Classification;
    if (playedIsBest || deliveredMate) {
      classification = "best"; // the engine's own pick, or delivered mate
    } else if (mateBefore !== null && mateAfter === null && matedAfter === null) {
      classification = "blunder"; // had a forced mate and let it go
    } else if (loss >= 300) classification = "blunder";
    else if (loss >= 150) classification = "mistake";
    else if (loss >= 70) classification = "inaccuracy";
    else if (loss <= 10) classification = "best";
    else classification = "good";

    if (classification === "blunder") blunders++;
    else if (classification === "mistake") mistakes++;
    else if (classification === "inaccuracy") inaccuracies++;
    else if (classification === "best") bestMoves++;

    if (color === "w") {
      whiteLoss += loss;
      whiteMoves++;
    } else {
      blackLoss += loss;
      blackMoves++;
    }

    const patternTags: string[] = [];
    // Only count a hanging piece as a pattern when the move actually cost
    // material - otherwise every wild position inflates the count.
    const costMaterial =
      classification === "blunder" || classification === "mistake" || classification === "inaccuracy";
    if (hanging.length > 0 && costMaterial) patternTags.push("hanging-piece");
    if (mateBefore !== null && classification === "blunder") patternTags.push("missed-mate");
    if (missedCapture) patternTags.push("missed-capture");
    if (mateAfter !== null) patternTags.push("walked-into-mate");
    if (matedAfter !== null) patternTags.push("delivering-mate");
    if (i < 20 && classification === "blunder") patternTags.push("opening-blunder");
    if (classification === "blunder" || classification === "mistake") patternTags.push("tactics");

    moves.push({
      index: i,
      ply: i + 1,
      san: h.san,
      uci: h.from + h.to + (h.promotion || ""),
      color,
      fenBefore: fens[i],
      fenAfter: fens[i + 1],
      evalBefore: before.evalWhite,
      evalAfter: after.evalWhite,
      bestUci: before.bestUci,
      bestSan,
      loss,
      classification,
      mateBefore,
      mateAfter,
      matedAfter,
      hanging,
      missedCapture,
      isCheck: h.san.includes("+") || h.san.includes("#"),
      isMate: h.san.includes("#"),
      explanation: "",
      patternTags,
    });
  }

  const accuracy = {
    white: whiteMoves === 0 ? 100 : Math.max(0, Math.round(100 - (whiteLoss / whiteMoves / 10) * 2)),
    black: blackMoves === 0 ? 100 : Math.max(0, Math.round(100 - (blackLoss / blackMoves / 10) * 2)),
  };

  return {
    headers,
    white: headers.White || "White",
    black: headers.Black || "Black",
    result: headers.Result || "*",
    moves,
    blunders,
    mistakes,
    inaccuracies,
    bestMoves,
    accuracy,
    finalEval: evals[evals.length - 1].evalWhite,
  };
}
