import React, { useEffect, useState } from "react";
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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [step, setStep] = useState<1 | 2>(1);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = (await apiFetch("/api/auth/users")) as User[];
        if (!cancelled) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load users", err);
        if (!cancelled) {
          setError("Failed to load users");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedUser = users.find((u) => u.userId === selectedUserId) ?? null;

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = newName.trim();
    const passcode = newPin.trim();

    if (!name) return;
    if (!/^\d{4}$/.test(passcode)) return;

    try {
      const created = (await apiFetch("/api/auth/users", {
        method: "POST",
        body: JSON.stringify({
          name,
          role: "user", // default; you'll promote in DB
          passcode,
        }),
      })) as User;

      setUsers((prev) => [...prev, created]);
      setCreating(false);
      setNewName("");
      setNewPin("");
      setSelectedUserId(created.userId);
      setStep(2);
    } catch (err) {
      console.error("Failed to create user", err);
      setError("Failed to create user");
    }
  }

  async function handleLogin() {
    if (!selectedUserId) return;
    if (!/^\d{4}$/.test(pin)) return;

    setError(null);

    try {
      const res = (await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUserId,
          passcode: pin,
        }),
      })) as LoginResponse;

      localStorage.setItem("authToken", res.token);
      localStorage.setItem("currentUser", JSON.stringify(res.user));

      console.log("Logged in as", res.user);
      // TODO: navigate to main app
    } catch (err) {
      console.error("Login failed", err);
      setError("Invalid user or passcode");
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
            {step === 1 ? "Who is on shift?" : "Enter your PIN"}
          </div>
          <div className="text-sm text-gray-500">
            {step === 1
              ? "Choose your user or create a new one."
              : selectedUser
              ? `Logging in as ${selectedUser.name}`
              : "Pick a user first"}
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Step 1: pick user */}
        {step === 1 && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-sm text-gray-500">Loading users…</div>
            ) : (
              <>
                {users.length === 0 && (
                  <div className="text-sm text-gray-500">
                    No users yet. Create the first one.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {users.map((u) => (
                    <button
                      key={u.userId}
                      type="button"
                      onClick={() => setSelectedUserId(u.userId)}
                      className={
                        "rounded-xl border px-3 py-3 text-left text-sm transition " +
                        (selectedUserId === u.userId
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-gray-200 bg-gray-50 hover:bg-gray-100")
                      }
                    >
                      <div className="font-medium">{u.name}</div>
                      <div className="text-[11px] uppercase tracking-wide opacity-75">
                        {u.role}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3">
              {/* secondary button, plain HTML */}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                + Create user
              </button>
              <Button
                onClick={() => {
                  if (selectedUserId) {
                    setPin("");
                    setStep(2);
                  }
                }}
                disabled={!selectedUserId}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: PIN input */}
        {step === 2 && (
          <div className="space-y-4">
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
                }}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Back
              </button>
              <Button onClick={handleLogin} disabled={!/^\d{4}$/.test(pin)}>
                Login
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create user modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-900">
                Create user
              </div>
              <div className="text-xs text-gray-500">
                New users are created with role{" "}
                <span className="font-semibold">user</span>. You can promote
                them to admin in the DB.
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreateUser}>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Full name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  4-digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(
                      e.target.value.replace(/[^0-9]/g, "").slice(0, 4)
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-center tracking-[0.5em]"
                  placeholder="••••"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                    setNewPin("");
                  }}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={
                    !newName.trim() || !/^\d{4}$/.test(newPin.trim())
                  }
                >
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
