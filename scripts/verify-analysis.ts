// Headless verification: runs the full analysis on the sample games and
// prints the numbers. Run with: npm run verify
// Exits non-zero if any check fails.

import { analyzePgn } from "../src/lib/analysis";
import { explainMove } from "../src/lib/explain";
import { buildTrainingPlan } from "../src/lib/training";
import { TinyEngine } from "../src/lib/engine";
import { SAMPLE_GAMES } from "../src/lib/samples";

function check(name: string, cond: boolean, detail = ""): void {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? " - " + detail : ""}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log("=== Engine sanity checks ===");
  const engine = new TinyEngine();
  const startMoves = engine.legalMoves();
  check("start position has 20 legal moves", startMoves.length === 20, `got ${startMoves.length}`);
  engine.loadFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  const reply = engine.bestMove(20000, 5);
  console.log(`  after 1. e4 the engine plays ${reply.uci} (score ${reply.score}cp, depth ${reply.depthReached}, ${reply.nodes} nodes)`);
  check("engine finds a reply to 1. e4", reply.uci.length >= 4);

  const fools = SAMPLE_GAMES.find((g) => g.id === "fools-mate")!;
  const scholars = SAMPLE_GAMES.find((g) => g.id === "scholars-mate")!;
  const immortal = SAMPLE_GAMES.find((g) => g.id === "immortal-game")!;

  console.log("\n=== Fool's Mate (4 plies) ===");
  const f = await analyzePgn(fools.pgn);
  console.log(`  moves analysed: ${f.moves.length}, blunders: ${f.blunders}, result: ${f.result}`);
  for (const m of f.moves) {
    console.log(`  ${m.ply}. ${m.san} [${m.classification}] loss=${m.loss}cp best=${m.bestSan}`);
  }
  check("fools mate has 4 plies", f.moves.length === 4);
  check("2. g4 is a blunder", f.moves[2].classification === "blunder", f.moves[2].classification);
  check("2... Qh4# is mate and the best move", f.moves[3].isMate === true && f.moves[3].classification === "best", `${f.moves[3].san} [${f.moves[3].classification}]`);
  const mateMove = f.moves.find((m) => m.isMate);
  check("mate move detected", mateMove !== undefined, mateMove ? mateMove.san : "none");

  console.log("\n=== Scholar's Mate (4 moves) ===");
  const s = await analyzePgn(scholars.pgn);
  console.log(`  moves analysed: ${s.moves.length}, blunders: ${s.blunders}, mistakes: ${s.mistakes}, result: ${s.result}`);
  for (const m of s.moves) {
    console.log(`  ${m.ply}. ${m.san} [${m.classification}] loss=${m.loss}cp best=${m.bestSan}`);
  }
  check("scholars mate has 7 plies", s.moves.length === 7);
  check("4. Qxf7# is mate", s.moves[6].isMate === true);

  console.log("\n=== Immortal Game (23 moves) ===");
  const t0 = Date.now();
  const g = await analyzePgn(immortal.pgn);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  moves analysed: ${g.moves.length} in ${secs}s`);
  console.log(`  blunders: ${g.blunders}, mistakes: ${g.mistakes}, inaccuracies: ${g.inaccuracies}, best: ${g.bestMoves}`);
  console.log(`  accuracy white ${g.accuracy.white}% / black ${g.accuracy.black}%`);
  console.log(`  final eval: ${g.finalEval}cp (white perspective)`);
  const flagged = g.moves.filter((m) => m.classification === "blunder" || m.classification === "mistake");
  for (const m of flagged) {
    console.log(`  ${m.ply}. ${m.san} [${m.classification}] loss=${m.loss}cp best=${m.bestSan}`);
    console.log(`     ${explainMove(m, g.white, g.black)}`);
  }
  check("immortal game has 45 plies", g.moves.length === 45, `got ${g.moves.length}`);
  check("immortal game ends in mate", g.moves[g.moves.length - 1].isMate === true);
  check("analysis found at least one blunder or mistake", flagged.length > 0, `${flagged.length} flagged`);

  const plan = buildTrainingPlan(g.moves);
  console.log(`\n  training plan: ${plan.headline}`);
  for (const d of plan.drills) {
    console.log(`  - ${d.title} (${d.count}x)`);
  }
  check("training plan has drills", plan.drills.length > 0, `${plan.drills.length} drills`);

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error("VERIFY CRASHED:", e);
  process.exit(1);
});
