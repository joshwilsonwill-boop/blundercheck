// Chess board rendered with Unicode glyphs (no downloaded piece sets).
// Highlights the last move. This is an analysis board: navigation happens
// through the move list and the prev/next buttons.

import { useMemo } from "react";

const GLYPHS: Record<string, string> = {
  K: "\u2654",
  Q: "\u2655",
  R: "\u2656",
  B: "\u2657",
  N: "\u2658",
  P: "\u2659",
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};

export interface BoardProps {
  fen: string;
  lastMove?: { from: string; to: string } | null;
  flipped?: boolean;
}

function fenToGrid(fen: string): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const rows = fen.split(" ")[0].split("/");
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (ch >= "1" && ch <= "8") {
        file += ch.charCodeAt(0) - 48;
      } else {
        grid[r][file] = ch;
        file++;
      }
    }
  }
  return grid;
}

export default function ChessBoard({ fen, lastMove, flipped = false }: BoardProps) {
  const grid = useMemo(() => fenToGrid(fen), [fen]);
  const files = flipped ? ["h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = flipped ? ["1", "2", "3", "4", "5", "6", "7", "8"] : ["8", "7", "6", "5", "4", "3", "2", "1"];

  // Display row dr / file df map back to the FEN grid row sr / file sf.
  const cellAt = (dr: number, df: number) => {
    const sr = flipped ? 7 - dr : dr;
    const sf = flipped ? 7 - df : df;
    const piece = grid[sr][sf];
    const sq = String.fromCharCode(97 + sf) + String(8 - sr);
    return { piece, sq, isLight: (sr + sf) % 2 === 0 };
  };

  return (
    <div className="w-full max-w-[560px]">
      <div className="grid grid-cols-[20px_1fr] gap-0">
        <div className="flex flex-col">
          {ranks.map((r) => (
            <div key={r} className="flex-1 flex items-center justify-center text-[10px] text-zinc-500">
              {r}
            </div>
          ))}
        </div>
        <div>
          <div className="grid grid-cols-8 aspect-square w-full rounded-md overflow-hidden ring-1 ring-zinc-700 shadow-2xl">
            {Array.from({ length: 8 }, (_, dr) =>
              Array.from({ length: 8 }, (_, df) => {
                const { piece, sq, isLight } = cellAt(dr, df);
                const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
                const isWhite = piece ? piece === piece.toUpperCase() : false;
                return (
                  <div
                    key={sq}
                    className={`relative flex items-center justify-center aspect-square select-none ${
                      isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"
                    } ${isLast ? "shadow-[inset_0_0_0_3px_rgba(250,204,21,0.85)]" : ""}`}
                    title={sq}
                  >
                    {piece && (
                      <span
                        className="leading-none"
                        style={{
                          fontSize: "clamp(22px, 7vw, 44px)",
                          color: isWhite ? "#fafafa" : "#1c1917",
                          textShadow: isWhite
                            ? "0 1px 2px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)"
                            : "0 1px 2px rgba(255,255,255,0.45)",
                        }}
                      >
                        {GLYPHS[piece]}
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
          <div className="grid grid-cols-8">
            {files.map((f) => (
              <div key={f} className="text-center text-[10px] text-zinc-500 py-0.5">
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
