import React, { useState } from "react";
import Button from "../components/Button";
import { apiFetch } from "../api/api";

type ClaimStaffCodeResponse = {
  userId: string;
  name: string;
  message: string;
};

type LookupStaffCodeResponse = {
  userId: string;
  name: string;
  message?: string;
};

type LoginPageProps = {
  /* Optional: parent can send us back to the user-selection screen */
  onBackToUserLogin?: () => void;
};

export default function LoginPage({ onBackToUserLogin }: LoginPageProps) {
  const [step, setStep] = useState<1 | 2>(1);

  const [code, setCode] = useState(""); // 4-digit staff code
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // optional: store verified worker info after lookup
  const [verifiedUser, setVerifiedUser] =
    useState<LookupStaffCodeResponse | null>(null);

  // still 4 digits for staff code
  const isCodeValid = /^\d{4}$/.test(code.trim());
  // allow 4–12 digits for personal PIN (matches backend validation)
  const isPinValid = /^\d{4,12}$/.test(pin.trim());

  // Step 1: verify staff code with server
  async function handleLookupCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isCodeValid || codeLoading) return;

    try {
      setCodeLoading(true);
      setCodeError(null);
      setPinError(null);
      setSuccessMessage(null);
      setPin("");
      setVerifiedUser(null);

      const resp = (await apiFetch("/api/auth/lookup-code", {
        method: "POST",
        body: JSON.stringify({
          staffCode: code.trim(),
        }),
      })) as LookupStaffCodeResponse;

      console.log("Lookup staff code resp:", resp);

      setVerifiedUser(resp);
      setStep(2);
    } catch (err) {
      console.error("Failed to lookup staff code", err);
      setCodeError(
        "Staff code not found or already used. Ask your manager to confirm it."
      );
    } finally {
      setCodeLoading(false);
    }
  }

  // Step 2: claim staff code + set personal PIN
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isCodeValid || !isPinValid || pinLoading) return;

    try {
      setPinLoading(true);
      setPinError(null);
      setCodeError(null);
      setSuccessMessage(null);

      const resp = (await apiFetch("/api/auth/claim-staff-code", {
        method: "POST",
        body: JSON.stringify({
          staffCode: code.trim(),
          passcode: pin.trim(),
        }),
      })) as ClaimStaffCodeResponse;

      console.log("Claim staff code resp:", resp);

      setSuccessMessage(
        resp?.message ||
          "User created. You can now log in with your personal code."
      );

      // clear inputs under the hood
      setStep(1);
      setCode("");
      setPin("");
      setVerifiedUser(null);

      // open success popup
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Failed to claim staff code", err);
      setPinError(
        "Failed to claim staff code. Check the code or ask the manager to confirm it."
      );
    } finally {
      setPinLoading(false);
    }
  }

  function handleGoToUserSelection() {
    setShowSuccessModal(false);

    if (onBackToUserLogin) {
      // Parent can switch back to UserLoginPanel
      onBackToUserLogin();
    } else {
      // Fallback: just reload SPA so your normal login screen shows again
      window.location.reload();
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
            {step === 1 ? "Enter your staff code" : "Choose your personal PIN"}
          </div>
          <div className="text-sm text-gray-500">
            {step === 1
              ? "Ask your manager for your 4-digit staff code."
              : verifiedUser
              ? `Hi ${verifiedUser.name}, choose your personal login PIN.`
              : "This PIN will be your personal login code."}
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

        {/* Step 2: Choose PIN */}
        {step === 2 && (
          <form className="space-y-4" onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={12}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.5em]"
              placeholder="New PIN"
            />
            <div className="flex items-center justify-between">
              <Button
                type="button"
                onClick={() => {
                  setStep(1);
                  setPin("");
                  setPinError(null);
                }}
              >
                Back
              </Button>
              <Button type="submit" disabled={!isPinValid || pinLoading}>
                {pinLoading ? "Saving…" : "Save PIN"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Success popup */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900">
              New user created
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {successMessage ||
                "User created successfully. You can now log in from the user selection screen."}
            </p>

            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={handleGoToUserSelection}>
                Go to user selection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
