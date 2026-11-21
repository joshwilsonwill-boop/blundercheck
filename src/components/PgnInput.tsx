// PGN input: paste, upload a .pgn file, or load a built-in sample game.

import { useRef, useState } from "react";
import { SAMPLE_GAMES } from "../lib/samples";

export interface PgnInputProps {
  onAnalyze: (pgn: string) => void;
  analyzing: boolean;
  progress: number;
  total: number;
}

export default function PgnInput({ onAnalyze, analyzing, progress, total }: PgnInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(pgn: string) {
    if (!pgn.trim()) {
      setError("Paste a PGN first, or load a sample game.");
      return;
    }
    setError(null);
    onAnalyze(pgn);
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      setText(content);
      submit(content);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  return (
    <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-4 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Analyse a game</h2>
        <p className="text-sm text-zinc-400">Paste a PGN, upload a .pgn file, or try a sample game.</p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={`[White "You"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 ...`}
        className="w-full rounded-md bg-zinc-950 border border-zinc-700 p-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => submit(text)}
          disabled={analyzing}
          className="rounded-md bg-amber-400 text-zinc-900 font-semibold px-4 py-2 text-sm hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {analyzing ? `Analysing... ${progress}/${total}` : "Analyse game"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyzing}
          className="rounded-md bg-zinc-800 text-zinc-100 font-medium px-4 py-2 text-sm hover:bg-zinc-700 disabled:opacity-40"
        >
          Upload .pgn file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pgn,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {analyzing && total > 0 && (
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${(progress / total) * 100}%` }} />
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Or try a sample game</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {SAMPLE_GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setText(g.pgn);
                submit(g.pgn);
              }}
              disabled={analyzing}
              className="text-left rounded-md bg-zinc-800 hover:bg-zinc-700 p-3 disabled:opacity-40"
            >
              <span className="block text-sm font-semibold text-zinc-100">{g.title}</span>
              <span className="block text-xs text-zinc-400 mt-0.5">{g.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
