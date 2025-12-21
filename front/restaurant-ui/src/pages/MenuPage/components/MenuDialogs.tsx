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
  Dialogs: () => JSX.Element | null;
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
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-gray-200 px-5 py-4">
                <div className="text-sm font-semibold text-gray-900">
                  {dialog.title}
                </div>
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-gray-600">{dialog.message}</div>
                {dialog.type === "prompt" && (
                  <input
                    className="mt-4 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                {dialog.type !== "alert" && (
                  <button
                    onClick={handleCancel}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleOk}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
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
