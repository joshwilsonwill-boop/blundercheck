import { TinyEngine, moveToUci } from "../src/lib/engine";
import { Chess } from "chess.js";

const engine = new TinyEngine();

function probe(fen: string, label: string) {
  engine.loadFen(fen);
  const res = engine.bestMove(20000, 5);
  const evalWhite = engine.turn === 0 ? res.score : -res.score;
  console.log(`${label}`);
  console.log(`  fen: ${fen}`);
  console.log(`  best: ${res.uci} score(stm)=${res.score} evalWhite=${evalWhite} mateIn=${res.mateIn} matedIn=${res.matedIn} depth=${res.depthReached} nodes=${res.nodes}`);
  console.log(`  inCheck=${engine.inCheck()} legalMoves=${engine.legalMoves().length}`);
}

// Fool's mate: after 1. f3 e5 2. g4 - Black to move, Qh4# is mate in 1
probe("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2", "After 2. g4 (Black to move, Qh4# available)");

// Check Qh4 is generated
engine.loadFen("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2");
const legal = engine.legalMoves().map(moveToUci);
console.log("  Qh4 in legal moves:", legal.includes("d8h4"), "| total legal:", legal.length);

// Immortal game: after 12. h4 (Black to move)
probe("r1bqkb1r/pp1n1ppp/2p1q3/2p1P3/2B1Pp1P/3P1N2/PPP2P1P/RNBQK2R b KQkq - 0 12", "Immortal after 12. h4 (approx - verify with chess.js)");

// Build the real Immortal FENs with chess.js
const game = new Chess();
game.loadPgn(`[Event "Immortal Game"]
[Site "London"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5
8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3
Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2
Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`);
const hist = game.history({ verbose: true });
const fens = [new Chess().fen(), ...hist.map((m) => m.after)];
console.log("\nImmortal FEN after 12. h4 (ply 23):", fens[23]);
console.log("Immortal FEN after 12...Qg6 (ply 24):", fens[24]);
probe(fens[23], "Immortal ply 23 (Black to move, before Qg6)");
probe(fens[24], "Immortal ply 24 (White to move, after Qg6)");
