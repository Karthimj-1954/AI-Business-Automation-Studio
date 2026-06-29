import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Business Automation Studio",
  description: "Automate your workflows, document RAG analysis, transcript summaries, and report generation in a unified studio.",
  keywords: ["AI Automation", "RAG", "Whisper Transcription", "Document Analysis", "Business Intelligence"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen bg-[#030014] text-slate-100 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
