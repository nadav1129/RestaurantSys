import React, { useState } from "react";
import Button from "../components/Button";
import { apiFetch } from "../api/api";

type User = {
  userId: string;
  name: string;
  role: string;
};

type LoginResponse = {
  token: string;
  user: User;
};

export default function LoginPage() {
  const [step, setStep] = useState<1 | 2>(1);

  const [code, setCode] = useState(""); // 4-digit staff code
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  const isCodeValid = /^\d{4}$/.test(code.trim());
  const isPinValid = /^\d{4}$/.test(pin.trim());

  async function handleLookupCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isCodeValid) return;

    try {
      setCodeLoading(true);
      setCodeError(null);
      setPinError(null);
      setUser(null);

      // New endpoint: find user by 4-digit code assigned from StaffPage
      const found = (await apiFetch("/api/auth/lookup-code", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      })) as User;

      setUser(found);
      setStep(2);
      setPin("");
    } catch (err) {
      console.error("Failed to lookup code", err);
      setCodeError("Code not found. Ask the manager to confirm your code.");
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isPinValid) return;

    try {
      setPinLoading(true);
      setPinError(null);

      const resp = (await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          userId: user.userId,
          passcode: pin.trim(),
        }),
      })) as LoginResponse & { success?: boolean };

      console.log("Login resp:", resp);
      // later: save token, navigate, etc.
      if (!resp || !(resp as any).token) {
        setPinError("Wrong PIN");
      }
    } catch (err) {
      console.error("Login failed", err);
      setPinError("Login failed. Try again.");
    } finally {
      setPinLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            RestaurantSys
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {step === 1 ? "Enter your staff code" : "Enter your PIN"}
          </div>
          <div className="text-sm text-gray-500">
            {step === 1
              ? "Ask your manager for your 4-digit staff code."
              : user
              ? `Logging in as ${user.name}`
              : "No user selected"}
          </div>
          {(codeError || pinError) && (
            <div className="mt-2 text-sm text-red-600">
              {codeError || pinError}
            </div>
          )}
        </div>

        {/* Step 1: Enter staff code */}
        {step === 1 && (
          <form className="space-y-4" onSubmit={handleLookupCode}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.5em]"
              placeholder="••••"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                New staff? Ask manager to add you in Staff page.
              </span>
              <Button type="submit" disabled={!isCodeValid || codeLoading}>
                {codeLoading ? "Checking…" : "Continue"}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: PIN input */}
        {step === 2 && (
          <form className="space-y-4" onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.5em]"
              placeholder="••••"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setPin("");
                  setPinError(null);
                }}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Back
              </button>
              <Button type="submit" disabled={!isPinValid || pinLoading}>
                {pinLoading ? "Logging in…" : "Login"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
