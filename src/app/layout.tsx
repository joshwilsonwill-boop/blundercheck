import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlunderCheck - a chess coach that explains your mistakes like a human",
  description:
    "Paste a PGN game and get every blunder explained in plain language, plus a training plan built from your actual weaknesses. Analysis runs locally in your browser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
