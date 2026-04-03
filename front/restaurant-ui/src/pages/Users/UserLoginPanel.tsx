import { useEffect, useState } from "react";
import { apiFetch } from "../../api/api";
import Button from "../../components/Button";
import { QuickOrderIcon, SearchIcon, XIcon } from "../../components/icons";

type User = {
  userId: string;
  name: string;
  role: string;
};

type LoginResponse = {
  token: string;
  user: User;
};

type Props = {
  onLoginSuccess: (resp: LoginResponse) => void;
  onClose?: () => void;
  onCreateNewUser: () => void;
};

export default function UserLoginPanel({
  onLoginSuccess,
  onClose,
  onCreateNewUser,
}: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      setLoadingUsers(true);
      setError(null);
      try {
        const data = (await apiFetch("/api/auth/users")) as User[];
        setUsers(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load users.");
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, []);

  const isPinValid = pin.length >= 4 && pin.length <= 12;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !isPinValid || pinLoading) return;

    setPinLoading(true);
    setError(null);

    try {
      const resp = (await apiFetch("/api/auth/login", {
        method: "POST",
        body: {
          userId: selectedUser.userId,
          passcode: pin.trim(),
        } as any,
      })) as LoginResponse;

      onLoginSuccess(resp);
      setPin("");
      setSelectedUser(null);
    } catch (err: any) {
      setError(err?.message || "Login failed.");
    } finally {
      setPinLoading(false);
    }
  }

  return (
    <div className="rs-overlay fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="rs-modal w-full max-w-3xl p-6 lg:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              Staff access
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              Select your user and enter your PIN
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Existing auth logic stays the same. This is a calmer, quicker way to scan and sign in.
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <XIcon className="h-4.5 w-4.5" />
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <div className="rs-input pl-11 text-sm text-[var(--muted-foreground)]">
                Choose a staff member from the list below
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-3">
              {loadingUsers ? (
                <div className="p-4 text-sm text-[var(--muted-foreground)]">
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="p-4 text-sm text-[var(--muted-foreground)]">
                  No users yet. Use "Create new user" below.
                </div>
              ) : (
                <ul className="space-y-2">
                  {users.map((u) => {
                    const active = selectedUser?.userId === u.userId;
                    return (
                      <li key={u.userId}>
                        <button
                          type="button"
                          className={[
                            "flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition",
                            active
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                              : "border-transparent bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--card-muted)]",
                          ].join(" ")}
                          onClick={() => {
                            setSelectedUser(u);
                            setPin("");
                            setError(null);
                          }}
                        >
                          <div>
                            <div className="text-sm font-semibold">{u.name}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.2em] opacity-80">
                              {u.role}
                            </div>
                          </div>
                          {active ? (
                            <div className="rounded-full bg-white/55 px-3 py-1 text-xs font-semibold">
                              Selected
                            </div>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <QuickOrderIcon className="h-5 w-5" />
            </div>
            <div className="mt-5 text-xl font-semibold text-[var(--foreground)]">
              {selectedUser ? selectedUser.name : "Select a user"}
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {selectedUser
                ? "Enter the personal code already assigned to this user."
                : "Once you choose a user, the PIN field will be ready here."}
            </div>

            {selectedUser ? (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  maxLength={12}
                  onChange={(e) =>
                    setPin(
                      e.target.value.replace(/[^0-9]/g, "").slice(0, 12)
                    )
                  }
                  className="rs-input text-center font-display text-2xl tracking-[0.4em]"
                  placeholder="••••"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSelectedUser(null);
                      setPin("");
                    }}
                  >
                    Change user
                  </Button>
                  <Button type="submit" disabled={!isPinValid || pinLoading}>
                    {pinLoading ? "Logging in..." : "Login"}
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="mt-8 border-t border-[var(--border)] pt-4">
              <div className="text-sm text-[var(--muted-foreground)]">
                New staff? Claim your staff code first.
              </div>
              <div className="mt-3">
                <Button type="button" onClick={onCreateNewUser}>
                  Create new user
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
