// TinyEngine - TypeScript port of Joshua's tiny-chess engine (Python, 4,068 bytes).
// Same 0x88 board, same piece values, same pawn piece-square table, same
// alpha-beta + quiescence search, same MVV-LVA move ordering, same iterative
// deepening on a fixed node budget. No Stockfish code, no GPL code - this is a
// port of his own engine, written by him for the tiny-chess-01 bounty.
//
// One deliberate addition for analysis: mate scores carry distance (a mate in
// 1 scores higher than a mate in 3), so the coach can say "mate in 2".
// Non-mate play is identical to the Python original.
//
// Board encoding: 0x88, B[128]. Piece = type | color bit.
// type: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king.
// color: 0 = white, 8 = black. T: 0 = white to move, 1 = black to move.
// Move encoding: from | to<<7 | promotion<<14, promotion 2..5 = n,b,r,q.

export const MATE_SCORE = 30000;
export const MATE_THRESHOLD = 29000;

const VALUES = [0, 100, 320, 330, 500, 900, 0];
const START_ROW = [4, 2, 3, 5, 6, 3, 2, 4];
const PST_SOURCE = "SSSSX]]?XNISSSSgXX]l]]gq{{{{SSSS";
const KNIGHT_DIRS = [31, 33, 14, 18, -31, -33, -14, -18];
const DIAG_DIRS = [15, 17, -15, -17];
const STRAIGHT_DIRS = [1, -1, 16, -16];
const ALL_DIRS = [...STRAIGHT_DIRS, ...DIAG_DIRS];
const DIRS: number[][] = [[], [], KNIGHT_DIRS, DIAG_DIRS, STRAIGHT_DIRS, ALL_DIRS, ALL_DIRS];
const CASTLE_MASK: Record<number, number> = { 0: 13, 7: 14, 4: 12, 112: 7, 119: 11, 116: 3 };
const PIECE_LETTERS = ["", "p", "n", "b", "r", "q", "k"];
const PIECE_NAMES = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
const PROMOTION_LETTERS = ["", "", "n", "b", "r", "q"];

export class NodeBudgetExceeded extends Error {
  constructor() {
    super("node budget exceeded");
  }
}

export function squareName(sq: number): string {
  return String.fromCharCode(97 + (sq & 7)) + String((sq >> 4) + 1);
}

export function squareFromName(name: string): number {
  return (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
}

export function moveToUci(move: number): string {
  const from = move & 127;
  const to = (move >> 7) & 127;
  const promo = move >> 14;
  return squareName(from) + squareName(to) + (promo ? PROMOTION_LETTERS[promo] : "");
}

export function uciToMove(uci: string): number {
  const from = squareFromName(uci.slice(0, 2));
  const to = squareFromName(uci.slice(2, 4));
  const promo = uci.length === 5 ? "nbrq".indexOf(uci[4]) + 2 : 0;
  return from | (to << 7) | (promo << 14);
}

export function pieceName(type: number): string {
  return PIECE_NAMES[type] || "piece";
}

export interface SearchResult {
  move: number; // best move (encoded int)
  uci: string;
  score: number; // centipawns, side-to-move perspective
  mateIn: number | null; // moves until mate for the side to move, if forced
  matedIn: number | null; // moves until the side to move is mated, if forced
  nodes: number;
  depthReached: number;
}

interface Undo {
  move: number;
  captured: number;
  castling: number;
  ep: number;
}

export class TinyEngine {
  private B: Int8Array = new Int8Array(128);
  private T = 0; // side to move: 0 white, 1 black
  private C = 15; // castling rights
  private E = -1; // en passant square, -1 = none
  private K = [4, 116]; // king squares
  private nodes = 0;
  private nodeBudget = 80000;
  private PST: number[][];

  constructor() {
    // Pawn piece-square table only (A[1]); all other pieces are zero tables,
    // exactly like the Python original.
    const pawnTable: number[] = [];
    for (let i = 0; i < 128; i++) {
      const idx = (i >> 4) * 4 + Math.min(i & 7, 7 - (i & 7));
      pawnTable.push(PST_SOURCE.charCodeAt(idx) - 83);
    }
    this.PST = [[], pawnTable, [], [], [], [], []];
    this.reset();
  }

  reset(): void {
    this.B.fill(0);
    for (let i = 0; i < 8; i++) {
      this.B[i] = START_ROW[i];
      this.B[112 + i] = START_ROW[i] + 8;
      this.B[16 + i] = 1;
      this.B[96 + i] = 9;
    }
    this.T = 0;
    this.C = 15;
    this.E = -1;
    this.K = [4, 116];
  }

  loadFen(fen: string): void {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 2) throw new Error("invalid FEN: " + fen);
    this.B.fill(0);
    const rows = parts[0].split("/");
    if (rows.length !== 8) throw new Error("invalid FEN placement: " + fen);
    for (let r = 0; r < 8; r++) {
      let file = 0;
      for (const ch of rows[r]) {
        if (ch >= "1" && ch <= "8") {
          file += ch.charCodeAt(0) - 48;
        } else {
          const type = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 }[ch.toLowerCase()];
          if (!type) throw new Error("invalid FEN piece: " + ch);
          const color = ch === ch.toUpperCase() ? 0 : 8;
          const sq = (7 - r) * 16 + file;
          this.B[sq] = type | color;
          if (type === 6) this.K[color === 0 ? 0 : 1] = sq;
          file++;
        }
      }
    }
    this.T = parts[1] === "b" ? 1 : 0;
    this.C = 0;
    if (parts[2] && parts[2] !== "-") {
      if (parts[2].includes("K")) this.C |= 1;
      if (parts[2].includes("Q")) this.C |= 2;
      if (parts[2].includes("k")) this.C |= 4;
      if (parts[2].includes("q")) this.C |= 8;
    }
    this.E = parts[3] && parts[3] !== "-" ? squareFromName(parts[3]) : -1;
  }

  get turn(): 0 | 1 {
    return this.T as 0 | 1;
  }

  get board(): Int8Array {
    return this.B;
  }

  /** Static evaluation, side-to-move perspective, centipawns. */
  evaluate(): number {
    let s = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 136) continue;
      const p = this.B[sq];
      if (!p) continue;
      const t = p & 7;
      const v = VALUES[t] + (this.PST[t][sq] || 0);
      s += p < 8 ? v : -(VALUES[t] + (this.PST[t][sq ^ 112] || 0));
    }
    return this.T === 0 ? s : -s;
  }

  /** Is square `sq` attacked by side `by` (0 white, 1 black)? */
  isAttacked(sq: number, by: 0 | 1): boolean {
    const pawnOffsets = by === 0 ? [-15, -17] : [15, 17];
    for (const o of pawnOffsets) {
      if (!((sq + o) & 136) && this.B[sq + o] === 1 + 8 * by) return true;
    }
    for (const o of KNIGHT_DIRS) {
      if (!((sq + o) & 136) && this.B[sq + o] === 2 + 8 * by) return true;
    }
    for (const o of ALL_DIRS) {
      if (!((sq + o) & 136) && this.B[sq + o] === 6 + 8 * by) return true;
    }
    for (const [dirs, type] of [
      [DIAG_DIRS, 3],
      [STRAIGHT_DIRS, 4],
    ] as const) {
      for (const o of dirs) {
        let r = sq + o;
        while (!(r & 136) && !this.B[r]) r += o;
        if (!(r & 136) && (this.B[r] >> 3) === by && (this.B[r] & 7) === 5) return true;
        if (!(r & 136) && (this.B[r] >> 3) === by && (this.B[r] & 7) === type) return true;
      }
    }
    return false;
  }

  /** Squares of `by` pieces attacking `sq` (for hanging-piece checks). */
  attackersOf(sq: number, by: 0 | 1): number[] {
    const out: number[] = [];
    const pawnOffsets = by === 0 ? [-15, -17] : [15, 17];
    for (const o of pawnOffsets) {
      if (!((sq + o) & 136) && this.B[sq + o] === 1 + 8 * by) out.push(sq + o);
    }
    for (const o of KNIGHT_DIRS) {
      if (!((sq + o) & 136) && this.B[sq + o] === 2 + 8 * by) out.push(sq + o);
    }
    for (const o of ALL_DIRS) {
      if (!((sq + o) & 136) && this.B[sq + o] === 6 + 8 * by) out.push(sq + o);
    }
    for (const dirs of [DIAG_DIRS, STRAIGHT_DIRS]) {
      for (const o of dirs) {
        let r = sq + o;
        while (!(r & 136) && !this.B[r]) r += o;
        if (!(r & 136) && (this.B[r] >> 3) === by) {
          const t = this.B[r] & 7;
          if (t === 5 || (dirs === DIAG_DIRS && t === 3) || (dirs === STRAIGHT_DIRS && t === 4)) {
            out.push(r);
          }
        }
      }
    }
    return out;
  }

  private makeMove(m: number): Undo {
    const from = m & 127;
    const to = (m >> 7) & 127;
    const promo = m >> 14;
    const p = this.B[from];
    let captured = this.B[to];
    this.B[to] = p;
    this.B[from] = 0;
    if (promo) this.B[to] = promo | (p & 8);
    if ((p & 7) === 6) {
      this.K[this.T] = to;
      if (Math.abs(to - from) === 2) {
        const a = to > from ? to + 1 : to - 2;
        const b = to > from ? to - 1 : to + 1;
        this.B[b] = this.B[a];
        this.B[a] = 0;
      }
    } else if ((p & 7) === 1 && to === this.E && (to & 7) !== (from & 7)) {
      const w = to - 16 + 32 * this.T;
      captured = this.B[w];
      this.B[w] = 0;
    }
    const undo: Undo = { move: m, captured, castling: this.C, ep: this.E };
    this.C &= (CASTLE_MASK[from] ?? 15) & (CASTLE_MASK[to] ?? 15);
    this.E = (p & 7) === 1 && Math.abs(to - from) === 32 ? (from + to) / 2 : -1;
    this.T ^= 1;
    return undo;
  }

  private unmakeMove(u: Undo): void {
    const m = u.move;
    const from = m & 127;
    const to = (m >> 7) & 127;
    const promo = m >> 14;
    const p = this.B[to];
    this.T ^= 1;
    const epCapture = (p & 7) === 1 && to === u.ep && (to & 7) !== (from & 7);
    if ((p & 7) === 6) {
      this.K[this.T] = from;
      if (Math.abs(to - from) === 2) {
        const a = to > from ? to + 1 : to - 2;
        const b = to > from ? to - 1 : to + 1;
        this.B[a] = this.B[b];
        this.B[b] = 0;
      }
    }
    this.B[to] = epCapture ? 0 : u.captured;
    if (epCapture) this.B[to - 16 + 32 * this.T] = u.captured;
    this.B[from] = promo ? 1 | (p & 8) : p;
    this.C = u.castling;
    this.E = u.ep;
  }

  private addPromotions(list: Array<[number, number]>, from: number, to: number): void {
    for (const pr of [5, 4, 3, 2]) {
      list.push([10000 + VALUES[pr], from | (to << 7) | (pr << 14)]);
    }
  }

  /** Move generation. capturesOnly = true generates captures only (quiescence). */
  generateMoves(capturesOnly: boolean): Array<[number, number]> {
    const ms: Array<[number, number]> = [];
    const d = this.T === 0 ? 16 : -16;
    const promoRank = this.T === 0 ? 6 : 1;
    const startRank = this.T === 0 ? 1 : 6;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 136) continue;
      const p = this.B[sq];
      if (!p || (p >> 3) !== this.T) continue;
      const t = p & 7;
      if (t === 1) {
        const isPromo = (sq >> 4) === promoRank;
        for (const o of [d, d - 1, d + 1]) {
          const r = sq + o;
          if (r & 136) continue;
          const v = this.B[r];
          const mv = sq | (r << 7);
          if (o === d) {
            if (v) continue;
            if (isPromo) this.addPromotions(ms, sq, r);
            else if (!capturesOnly) {
              ms.push([0, mv]);
              if ((sq >> 4) === startRank && !this.B[sq + 2 * d]) {
                ms.push([0, sq | ((sq + 2 * d) << 7)]);
              }
            }
          } else if (v && (v >> 3) !== this.T) {
            if (isPromo) this.addPromotions(ms, sq, r);
            else ms.push([10000 + VALUES[v & 7], mv]);
          } else if (r === this.E && (r & 7) !== (sq & 7)) {
            ms.push([10000, mv]);
          }
        }
      } else {
        for (const o of DIRS[t]) {
          let r = sq + o;
          while (!(r & 136)) {
            const v = this.B[r];
            if (v) {
              if ((v >> 3) !== this.T) ms.push([10000 + VALUES[v & 7], sq | (r << 7)]);
              break;
            }
            if (!capturesOnly) ms.push([0, sq | (r << 7)]);
            if (t === 2 || t === 6) break;
            r += o;
          }
        }
        if (t === 6) {
          for (const [k, bit, far] of [
            [1, 1 << (2 * this.T), 0],
            [-1, 2 << (2 * this.T), 1],
          ] as const) {
            const between = far === 0 ? [1, 2] : [1, 2, 3];
            const path = [0, 1, 2];
            if (
              this.C & bit &&
              !between.some((i) => this.B[sq + i * k]) &&
              !path.some((i) => this.isAttacked(sq + i * k, (this.T ^ 1) as 0 | 1))
            ) {
              ms.push([0, sq | ((sq + 2 * k) << 7)]);
            }
          }
        }
      }
    }
    ms.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    return ms;
  }

  /** Legal moves (filters out moves that leave the king in check). */
  legalMoves(): number[] {
    const out: number[] = [];
    for (const [, m] of this.generateMoves(false)) {
      const u = this.makeMove(m);
      if (!this.isAttacked(this.K[this.T ^ 1], this.T as 0 | 1)) out.push(m);
      this.unmakeMove(u);
    }
    return out;
  }

  inCheck(): boolean {
    return this.isAttacked(this.K[this.T], (this.T ^ 1) as 0 | 1);
  }

  isCheckmate(): boolean {
    return this.inCheck() && this.legalMoves().length === 0;
  }

  isStalemate(): boolean {
    return !this.inCheck() && this.legalMoves().length === 0;
  }

  private search(alpha: number, beta: number, depth: number, ply: number): number {
    this.nodes++;
    if (this.nodes > this.nodeBudget) throw new NodeBudgetExceeded();
    const inChk = this.isAttacked(this.K[this.T], (this.T ^ 1) as 0 | 1);
    let n = 0;
    if (depth <= 0 && !inChk) {
      let s = this.evaluate();
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
    }
    for (const [, m] of this.generateMoves(depth > 0 || inChk ? false : true)) {
      const u = this.makeMove(m);
      try {
        if (this.isAttacked(this.K[this.T ^ 1], this.T as 0 | 1)) continue;
        const s = -this.search(-beta, -alpha, depth - 1, ply + 1);
        n++;
        if (s > alpha) alpha = s;
        if (alpha >= beta) break;
      } finally {
        // Unmake even when the node budget throws, or the board and the side
        // to move are left corrupted for the caller.
        this.unmakeMove(u);
      }
    }
    if (n === 0 && (depth > 0 || inChk)) return inChk ? -(MATE_SCORE - ply) : 0;
    return alpha;
  }

  /**
   * Root search: iterative deepening on a fixed node budget.
   * Returns the best move and its score (side-to-move perspective).
   */
  bestMove(nodeBudget = 80000, maxDepth = 5): SearchResult {
    this.nodeBudget = nodeBudget;
    this.nodes = 0;
    const legal: number[] = [];
    for (const [, m] of this.generateMoves(false)) {
      const u = this.makeMove(m);
      if (!this.isAttacked(this.K[this.T ^ 1], this.T as 0 | 1)) legal.push(m);
      this.unmakeMove(u);
    }
    if (legal.length === 0) {
      return {
        move: 0,
        uci: "",
        score: this.inCheck() ? -MATE_SCORE : 0,
        mateIn: null,
        matedIn: this.inCheck() ? 0 : null,
        nodes: 0,
        depthReached: 0,
      };
    }
    let best = legal[0];
    let bestScore = -MATE_SCORE;
    let depthReached = 0;
    for (let d = 1; d <= maxDepth; d++) {
      try {
        let alpha = -MATE_SCORE;
        for (const m of legal) {
          const u = this.makeMove(m);
          try {
            const s = -this.search(-MATE_SCORE, -alpha, d - 1, 1);
            if (s > alpha) {
              alpha = s;
              best = m;
            }
          } finally {
            this.unmakeMove(u);
          }
        }
        bestScore = alpha;
        depthReached = d;
        legal.splice(legal.indexOf(best), 1);
        legal.unshift(best);
      } catch (e) {
        if (!(e instanceof NodeBudgetExceeded)) throw e;
        break;
      }
    }
    const mateIn = bestScore > MATE_THRESHOLD ? MATE_SCORE - bestScore : null;
    const matedIn = bestScore < -MATE_THRESHOLD ? MATE_SCORE + bestScore : null;
    return {
      move: best,
      uci: moveToUci(best),
      score: bestScore,
      mateIn,
      matedIn,
      nodes: this.nodes,
      depthReached,
    };
  }

  /**
   * Pieces of `color` that are hanging in the current position: attacked by the
   * enemy and either undefended or attacked by a cheaper piece (losing trade).
   * Returns { square, pieceType, attackerSquares }.
   */
  hangingPieces(color: 0 | 1): Array<{ square: number; pieceType: number; attackerSquares: number[] }> {
    const enemy = (color ^ 1) as 0 | 1;
    const out: Array<{ square: number; pieceType: number; attackerSquares: number[] }> = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 136) continue;
      const p = this.B[sq];
      if (!p || (p >> 3) !== color) continue;
      const type = p & 7;
      if (type === 6) continue; // the king is never "hanging"
      const attackers = this.attackersOf(sq, enemy);
      if (attackers.length === 0) continue;
      const minAttackerValue = Math.min(...attackers.map((a) => VALUES[this.B[a] & 7]));
      const defenders = this.attackersOf(sq, color);
      if (defenders.length === 0 || minAttackerValue < VALUES[type]) {
        out.push({ square: sq, pieceType: type, attackerSquares: attackers });
      }
    }
    return out;
  }
}
