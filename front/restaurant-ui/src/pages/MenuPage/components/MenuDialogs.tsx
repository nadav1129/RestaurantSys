import React, { useCallback, useMemo, useState } from "react";

type DialogType = "alert" | "confirm" | "prompt";

type DialogState = {
  type: DialogType;
  title: string;
  message: string;
  defaultValue?: string;
  resolve: (value: any) => void;
};

type DialogOptions = {
  title?: string;
  defaultValue?: string;
};

export type MenuDialogApi = {
  alert: (message: string, options?: DialogOptions) => Promise<void>;
  confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
  prompt: (message: string, options?: DialogOptions) => Promise<string | null>;
  Dialogs: () => React.JSX.Element | null;
};

export default function useMenuDialogs(): MenuDialogApi {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState("");

  const openDialog = useCallback(
    (type: DialogType, message: string, options?: DialogOptions) => {
      return new Promise<any>((resolve) => {
        setDialog({
          type,
          title:
            options?.title ??
            (type === "alert" ? "Notice" : type === "confirm" ? "Confirm" : "Enter"),
          message,
          defaultValue: options?.defaultValue,
          resolve,
        });
        setInputValue(options?.defaultValue ?? "");
      });
    },
    []
  );

  const alert = useCallback(
    (message: string, options?: DialogOptions) =>
      openDialog("alert", message, options),
    [openDialog]
  );

  const confirm = useCallback(
    (message: string, options?: DialogOptions) =>
      openDialog("confirm", message, options),
    [openDialog]
  );

  const prompt = useCallback(
    (message: string, options?: DialogOptions) =>
      openDialog("prompt", message, options),
    [openDialog]
  );

  const close = useCallback(() => setDialog(null), []);

  const handleOk = useCallback(() => {
    if (!dialog) return;
    if (dialog.type === "prompt") {
      dialog.resolve(inputValue);
    } else if (dialog.type === "confirm") {
      dialog.resolve(true);
    } else {
      dialog.resolve(undefined);
    }
    close();
  }, [dialog, inputValue, close]);

  const handleCancel = useCallback(() => {
    if (!dialog) return;
    if (dialog.type === "prompt") {
      dialog.resolve(null);
    } else if (dialog.type === "confirm") {
      dialog.resolve(false);
    } else {
      dialog.resolve(undefined);
    }
    close();
  }, [dialog, close]);

  const Dialogs = useMemo(
    () =>
      function DialogsComponent() {
        if (!dialog) return null;
        return (
          <div className="rs-overlay fixed inset-0 z-50 flex items-start justify-center p-6">
            <div className="rs-modal w-full max-w-md">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  {dialog.title}
                </div>
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-[var(--muted-foreground)]">{dialog.message}</div>
                {dialog.type === "prompt" && (
                  <input
                    className="rs-input mt-4"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
                {dialog.type !== "alert" && (
                  <button
                    onClick={handleCancel}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleOk}
                  className="rounded-2xl border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition hover:brightness-110"
                >
                  {dialog.type === "alert" ? "OK" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        );
      },
    [dialog, inputValue, handleOk, handleCancel]
  );

  return { alert, confirm, prompt, Dialogs };
}
