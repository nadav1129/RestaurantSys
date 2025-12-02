import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/api";
import Button from "../../components/Button";


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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Login</h2>
            <p className="text-xs text-gray-500">
              Select your user and enter your personal code.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Close
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* User list */}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200">
          {loadingUsers ? (
            <div className="p-4 text-sm text-gray-500">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              No users yet. Use &quot;Create new user&quot; below.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {users.map((u) => (
                <li
                  key={u.userId}
                  className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm ${
                    selectedUser?.userId === u.userId
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setSelectedUser(u);
                    setPin("");
                    setError(null);
                  }}
                >
                  <div>
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      {u.role}
                    </div>
                  </div>
                  {selectedUser?.userId === u.userId && (
                    <span className="text-xs font-semibold text-blue-600">
                      Selected
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* PIN popup area */}
        {selectedUser && (
          <form onSubmit={handleLogin} className="mt-4 space-y-3">
            <div className="text-xs text-gray-600">
              Enter code for{" "}
              <span className="font-semibold">{selectedUser.name}</span>
            </div>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              maxLength={12}
              onChange={(e) =>
                setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-xl tracking-[0.4em]"
              placeholder="••••"
            />
            <div className="flex justify-between items-center">
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
                {pinLoading ? "Logging in…" : "Login"}
              </Button>
            </div>
          </form>
        )}

        {/* Bottom: create new user */}
        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500">
            New staff? Claim your staff code first.
          </div>
          <Button
  type="button"
  onClick={onCreateNewUser}
>
  Create new user
</Button>

        </div>
      </div>
    </div>
  );
}
