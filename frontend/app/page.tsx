"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Bot, 
  FileText, 
  Terminal, 
  Sparkles, 
  Play, 
  Layers, 
  Database, 
  Cpu, 
  ShieldAlert, 
  ArrowRight
} from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Decorative Glow Elements */}
      <div className="glow-bg top-[10%] left-[5%]" />
      <div className="glow-bg bottom-[10%] right-[5%] bg-indigo-950/20" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-neon flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-primary-300">
            Automation Studio
          </span>
        </div>
        <div>
          <a
            href="/login"
            className="px-5 py-2.5 rounded-xl glass-panel text-sm font-medium hover:bg-white/5 transition-all duration-300 flex items-center gap-2 border border-white/10"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Main Hero */}
      <main className="w-full max-w-7xl mx-auto px-6 py-12 flex-grow flex flex-col items-center justify-center text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border border-white/5 text-xs text-primary-300 mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent-neon" />
          <span>Next-Generation Intelligent Business Workflows</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight mb-8"
        >
          <span className="text-gradient">Automate Complex</span>
          <br />
          <span className="text-gradient-neon">Business Operations with AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-slate-400 text-lg md:text-xl max-w-2xl mb-12 font-light"
        >
          A unified workspace for AI-powered document intelligence, RAG-enabled search, transcription summaries, email synthesis, and custom drag-and-drop workflows.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 mb-20"
        >
          <a
            href="/login"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white font-semibold transition-all duration-300 shadow-xl shadow-primary-500/20 flex items-center justify-center gap-2"
          >
            Launch Studio <Play className="w-4 h-4 fill-white" />
          </a>
          <a
            href="#features"
            className="px-8 py-4 rounded-xl glass-panel border border-white/10 hover:bg-white/5 text-slate-200 font-semibold transition-all duration-300 flex items-center justify-center"
          >
            Explore Core Features
          </a>
        </motion.div>

        {/* Feature Highlights Grid */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-8">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-6 rounded-2xl glass-panel-glow text-left flex flex-col justify-between h-[200px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                <Database className="w-6 h-6 text-primary-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-accent-neon font-semibold">RAG Database</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-white mb-2">Knowledge Base RAG</h3>
              <p className="text-slate-400 text-sm font-light">Chunk, embed, and search your PDF, DOCX, and slides securely with pgvector semantic retrieval.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 rounded-2xl glass-panel-glow text-left flex flex-col justify-between h-[200px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                <Cpu className="w-6 h-6 text-primary-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-accent-emerald font-semibold">AI Agents</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-white mb-2">Multimodal OCR & Audio</h3>
              <p className="text-slate-400 text-sm font-light">Extract text from scans using OCR and transcribe audio meetings using Whisper with structural outlines.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-6 rounded-2xl glass-panel-glow text-left flex flex-col justify-between h-[200px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                <Layers className="w-6 h-6 text-primary-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-accent-amber font-semibold">Visual Editor</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-white mb-2">AI Workflow Builder</h3>
              <p className="text-slate-400 text-sm font-light">Chain multiple automated steps, prompting models, generating reports, and exporting PPTX files.</p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 z-10 gap-4">
        <div>
          &copy; 2026 AI Business Automation Studio. All rights reserved.
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-slate-300">Privacy Policy</a>
          <a href="#" className="hover:text-slate-300">Terms of Service</a>
          <a href="#" className="hover:text-slate-300">Contact Support</a>
        </div>
      </footer>
    </div>
  );
}
