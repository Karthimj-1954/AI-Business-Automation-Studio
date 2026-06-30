"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/app/firebase";
import OtpInput from "@/components/OtpInput";
import { Phone, ShieldAlert, CheckCircle2, Loader2, ArrowLeft, RefreshCw } from "lucide-react";

// Common country codes
const COUNTRY_CODES = [
  { code: "+91", country: "IN", label: "India (+91)" },
  { code: "+1", country: "US", label: "USA (+1)" },
  { code: "+44", country: "GB", label: "UK (+44)" },
  { code: "+61", country: "AU", label: "Australia (+61)" },
  { code: "+81", country: "JP", label: "Japan (+81)" },
  { code: "+49", country: "DE", label: "Germany (+49)" },
  { code: "+33", country: "FR", label: "France (+33)" },
  { code: "+971", country: "AE", label: "UAE (+971)" },
  { code: "+65", country: "SG", label: "Singapore (+65)" },
  { code: "+86", country: "CN", label: "China (+86)" },
  { code: "+55", country: "BR", label: "Brazil (+55)" },
  { code: "+82", country: "KR", label: "South Korea (+82)" },
  { code: "+39", country: "IT", label: "Italy (+39)" },
  { code: "+34", country: "ES", label: "Spain (+34)" },
  { code: "+7", country: "RU", label: "Russia (+7)" },
  { code: "+27", country: "ZA", label: "South Africa (+27)" },
  { code: "+60", country: "MY", label: "Malaysia (+60)" },
  { code: "+62", country: "ID", label: "Indonesia (+62)" },
  { code: "+66", country: "TH", label: "Thailand (+66)" },
  { code: "+63", country: "PH", label: "Philippines (+63)" },
];

// Firebase error code to user-friendly message mapping
const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-phone-number": "Please enter a valid phone number with country code.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/invalid-verification-code": "The OTP you entered is incorrect. Please try again.",
  "auth/code-expired": "This OTP has expired. Please request a new one.",
  "auth/network-request-failed": "Network error. Please check your connection and try again.",
  "auth/captcha-check-failed": "reCAPTCHA verification failed. Please refresh and try again.",
  "auth/quota-exceeded": "SMS quota exceeded. Please try again later.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/operation-not-allowed": "Phone authentication is not enabled. Contact the administrator.",
  "auth/missing-phone-number": "Please enter your phone number.",
};

function getErrorMessage(error: any): string {
  const code = error?.code || "";
  return ERROR_MESSAGES[code] || error?.message || "An unexpected error occurred. Please try again.";
}

function validatePhoneNumber(phone: string): boolean {
  // Must be digits only (after removing spaces/dashes), minimum 6 digits, max 15
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^\d{6,15}$/.test(cleaned);
}

interface PhoneLoginProps {
  onSuccess: () => void;
}

export default function PhoneLogin({ onSuccess }: PhoneLoginProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Cleanup reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (_) {}
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const initRecaptcha = useCallback(() => {
    // Clear any existing verifier
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (_) {}
      recaptchaVerifierRef.current = null;
    }

    // Wait for container to be in DOM
    if (!recaptchaContainerRef.current) return null;

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved — will proceed with signInWithPhoneNumber
      },
      "expired-callback": () => {
        setErrorMsg("reCAPTCHA expired. Please try again.");
        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch (_) {}
          recaptchaVerifierRef.current = null;
        }
      },
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Validate phone number
    if (!validatePhoneNumber(phoneNumber)) {
      setErrorMsg("Please enter a valid phone number (6-15 digits).");
      return;
    }

    setLoading(true);

    try {
      const verifier = initRecaptcha();
      if (!verifier) {
        setErrorMsg("Failed to initialize reCAPTCHA. Please refresh the page.");
        setLoading(false);
        return;
      }

      const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/[\s\-()]/g, "")}`;
      const result = await signInWithPhoneNumber(auth, fullPhoneNumber, verifier);
      setConfirmationResult(result);
      setStep("otp");
      setResendTimer(60);
      setSuccessMsg(`OTP sent to ${fullPhoneNumber}`);
    } catch (error: any) {
      setErrorMsg(getErrorMessage(error));
      // Reset reCAPTCHA on failure
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (_) {}
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (otp.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!confirmationResult) {
      setErrorMsg("Session expired. Please request a new OTP.");
      setStep("phone");
      return;
    }

    setLoading(true);

    try {
      await confirmationResult.confirm(otp);
      setSuccessMsg("Verified successfully! Redirecting...");
      // Small delay for user to see success message
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (error: any) {
      setErrorMsg(getErrorMessage(error));
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setErrorMsg("");
    setSuccessMsg("");
    setOtp("");
    setLoading(true);

    try {
      const verifier = initRecaptcha();
      if (!verifier) {
        setErrorMsg("Failed to initialize reCAPTCHA. Please refresh the page.");
        setLoading(false);
        return;
      }

      const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/[\s\-()]/g, "")}`;
      const result = await signInWithPhoneNumber(auth, fullPhoneNumber, verifier);
      setConfirmationResult(result);
      setResendTimer(60);
      setSuccessMsg(`New OTP sent to ${fullPhoneNumber}`);
    } catch (error: any) {
      setErrorMsg(getErrorMessage(error));
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (_) {}
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep("phone");
    setOtp("");
    setErrorMsg("");
    setSuccessMsg("");
    setConfirmationResult(null);
  };

  return (
    <div>
      {/* Invisible reCAPTCHA container */}
      <div ref={recaptchaContainerRef} id="recaptcha-container" />

      {/* Error Alert */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm flex gap-3 items-start">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-400 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {step === "phone" ? (
        /* ========== PHONE NUMBER STEP ========== */
        <form onSubmit={handleSendOtp} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Country Code
            </label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 appearance-none cursor-pointer"
            >
              {COUNTRY_CODES.map((cc) => (
                <option key={cc.code} value={cc.code} className="bg-[#1a1a2e] text-white">
                  {cc.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Phone className="w-4 h-4" />
              </span>
              <input
                type="tel"
                required
                placeholder="Enter your phone number"
                value={phoneNumber}
                onChange={(e) => {
                  // Allow only digits, spaces, dashes
                  const val = e.target.value.replace(/[^\d\s\-()]/g, "");
                  setPhoneNumber(val);
                }}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Enter number without country code (e.g., 9876543210)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !phoneNumber.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white font-semibold transition-all duration-300 shadow-xl shadow-primary-500/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              "Send OTP"
            )}
          </button>
        </form>
      ) : (
        /* ========== OTP VERIFICATION STEP ========== */
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          {/* Back button */}
          <button
            type="button"
            onClick={handleBackToPhone}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Change number
          </button>

          <div className="text-center">
            <p className="text-sm text-slate-400 mb-1">
              Enter the 6-digit code sent to
            </p>
            <p className="text-sm font-semibold text-white">
              {countryCode} {phoneNumber}
            </p>
          </div>

          {/* OTP Input */}
          <OtpInput
            value={otp}
            onChange={setOtp}
            disabled={loading}
          />

          {/* Verify Button */}
          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white font-semibold transition-all duration-300 shadow-xl shadow-primary-500/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify OTP"
            )}
          </button>

          {/* Resend OTP */}
          <div className="text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-slate-500">
                Resend OTP in <span className="text-primary-400 font-semibold">{resendTimer}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-sm text-primary-400 hover:text-primary-300 font-semibold focus:outline-none flex items-center gap-1.5 mx-auto transition-colors duration-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Resend OTP
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
