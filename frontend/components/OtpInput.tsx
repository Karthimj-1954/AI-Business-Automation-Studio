"use client";

import React, { useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function OtpInput({ length = 6, value, onChange, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split value into individual characters
  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

  useEffect(() => {
    // Auto-focus first empty input
    if (!disabled) {
      const firstEmpty = digits.findIndex((d) => !d);
      const targetIndex = firstEmpty === -1 ? length - 1 : firstEmpty;
      inputRefs.current[targetIndex]?.focus();
    }
  }, []);

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return; // Only allow single digit

    const newDigits = [...digits];
    newDigits[index] = char;
    const newValue = newDigits.join("").slice(0, length);
    onChange(newValue);

    // Auto-focus next input
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // If current input is empty, go back and clear previous
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        onChange(newDigits.join("").replace(/\s/g, ""));
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newDigits = [...digits];
        newDigits[index] = "";
        onChange(newDigits.join("").replace(/\s/g, ""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      // Focus the input after the last pasted digit
      const focusIndex = Math.min(pastedData.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[index] || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoComplete="one-time-code"
          className={`
            w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl
            bg-white/5 border text-white
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${digits[index] ? "border-primary-500/50" : "border-white/10"}
          `}
        />
      ))}
    </div>
  );
}
