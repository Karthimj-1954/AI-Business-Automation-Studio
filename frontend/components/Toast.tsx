"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastProps) {
  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-accent-emerald" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-accent-amber" />;
      case "info":
      default:
        return <Info className="w-5 h-5 text-accent-neon" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case "success":
        return "border-accent-emerald/30 shadow-accent-emerald/5";
      case "error":
        return "border-red-500/30 shadow-red-500/5";
      case "warning":
        return "border-accent-amber/30 shadow-accent-amber/5";
      case "info":
      default:
        return "border-accent-neon/30 shadow-accent-neon/5";
    }
  };

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 50, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95, transition: { duration: 0.2 } }}
            className={`pointer-events-auto p-4 rounded-2xl glass-panel-glow border flex gap-3.5 justify-between items-start shadow-xl ${getBorderColor(
              toast.type
            )}`}
          >
            <div className="flex gap-3">
              <div className="mt-0.5">{getIcon(toast.type)}</div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">{toast.title}</h4>
                <p className="text-xs text-slate-400 mt-1 font-light leading-relaxed">{toast.message}</p>
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded-lg hover:bg-white/5 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
