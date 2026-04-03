import { useState } from "react";
import Button from "../components/Button";
import { QuickOrderIcon, SettingsIcon } from "../components/icons";
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
  onBackToUserLogin?: () => void;
};

export default function LoginPage({ onBackToUserLogin }: LoginPageProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [verifiedUser, setVerifiedUser] =
    useState<LookupStaffCodeResponse | null>(null);

  const isCodeValid = /^\d{4}$/.test(code.trim());
  const isPinValid = /^\d{4,12}$/.test(pin.trim());

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
        body: {
          staffCode: code.trim(),
        },
      })) as LookupStaffCodeResponse;

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
        body: {
          staffCode: code.trim(),
          passcode: pin.trim(),
        },
      })) as ClaimStaffCodeResponse;

      setSuccessMessage(
        resp?.message ||
          "User created. You can now log in with your personal code."
      );

      setStep(1);
      setCode("");
      setPin("");
      setVerifiedUser(null);
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
      onBackToUserLogin();
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="min-h-screen bg-app px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.95fr]">
        <div className="rs-surface flex min-h-[640px] flex-col justify-between p-8 lg:p-10">
          <div>
            <div className="rs-pill w-fit">
              <SettingsIcon className="h-4 w-4" />
              Staff onboarding
            </div>
            <div className="mt-6 font-display text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Personal access that feels calmer and clearer.
            </div>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted-foreground)]">
              Staff first confirm their 4-digit code, then choose a personal PIN.
              The workflow stays identical, but the interface now reads like a polished product instead of a temporary setup screen.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rs-surface-muted p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Step 1
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Enter the staff code you received from management.
              </div>
            </div>
            <div className="rs-surface-muted p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Step 2
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Set a secure personal PIN for future sign-ins.
              </div>
            </div>
          </div>
        </div>

        <div className="rs-modal p-8 lg:p-10">
          <div className="mb-8">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              RestaurantSys
            </div>
            <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {step === 1 ? "Enter your staff code" : "Choose your personal PIN"}
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {step === 1
                ? "Ask your manager for your 4-digit staff code."
                : verifiedUser
                  ? `Hi ${verifiedUser.name}, choose your personal login PIN.`
                  : "This PIN will be your personal login code."}
            </div>
          </div>

          {codeError || pinError ? (
            <div className="mb-6 rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
              {codeError || pinError}
            </div>
          ) : null}

          {step === 1 ? (
            <form className="space-y-6" onSubmit={handleLookupCode}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                }
                className="rs-input text-center font-display text-4xl tracking-[0.55em]"
                placeholder="••••"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">
                  New staff? Ask management to add you in the Staff page first.
                </span>
                <Button type="submit" disabled={!isCodeValid || codeLoading}>
                  {codeLoading ? "Checking..." : "Continue"}
                </Button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleLogin}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={12}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))
                }
                className="rs-input text-center font-display text-3xl tracking-[0.45em]"
                placeholder="New PIN"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep(1);
                    setPin("");
                    setPinError(null);
                  }}
                >
                  Back
                </Button>
                <Button type="submit" disabled={!isPinValid || pinLoading}>
                  {pinLoading ? "Saving..." : "Save PIN"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showSuccessModal && (
        <div className="rs-overlay fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="rs-modal w-full max-w-sm p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <QuickOrderIcon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold text-[var(--foreground)]">
              New user created
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              {successMessage ||
                "User created successfully. You can now log in from the user selection screen."}
            </p>

            <div className="mt-6 flex justify-end">
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
