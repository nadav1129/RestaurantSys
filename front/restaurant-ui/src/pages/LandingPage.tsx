import { createElement, useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import {
  DevicesIcon,
  PrinterIcon,
  SparklesIcon,
  StationsIcon,
} from "../components/icons";
import { apiFetch } from "../api/api";
import type { ManagedDevice } from "../types";

type LandingPageProps = {
  onConfigured: (device: ManagedDevice) => void;
  onSkip: () => void;
};

export default function LandingPage({
  onConfigured,
  onSkip,
}: LandingPageProps) {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await apiFetch("/api/devices");
        const nextDevices = Array.isArray(resp) ? (resp as ManagedDevice[]) : [];

        if (cancelled) return;

        setDevices(nextDevices);
        if (nextDevices.length > 0) {
          setSelectedDeviceId(nextDevices[0].deviceId);
        }
      } catch (e) {
        console.error("Failed to load landing devices", e);
        if (!cancelled) setError("Failed to load configured devices.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-6 py-10 text-[var(--foreground)]">
      <div className="absolute inset-0">
        {createElement("spline-viewer", {
          url: "https://prod.spline.design/HB-rf3G5ZuE7DPLy/scene.splinecode",
          className: "h-full w-full scale-[1.08] opacity-90",
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,24,0.18),rgba(7,12,24,0.48))]" />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_55%,transparent)] blur-3xl" />
        <div className="absolute bottom-[-14%] right-[-6%] h-80 w-80 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_20%,transparent)] blur-3xl" />
      </div>

      <section className="rs-surface relative z-10 w-full max-w-2xl bg-[color:color-mix(in_srgb,var(--card)_88%,rgba(10,15,28,0.28))] p-8 sm:p-10">
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[var(--accent)] text-[var(--accent-foreground)]">
          <SparklesIcon className="h-6 w-6" />
        </div>

        <div className="space-y-4">
          <div className="rs-eyebrow">RestaurantSys</div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
            Welcome
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
            On first launch, choose which saved device this tablet should use.
            Device, printer, and station routing all come from Management.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Device
            </span>
            <select
              className="rs-select w-full"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={loading || devices.length === 0}
            >
              <option value="">
                {loading
                  ? "Loading devices..."
                  : devices.length === 0
                  ? "No devices configured yet"
                  : "Select a device..."}
              </option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.deviceName}
                  {device.stationName ? ` -> ${device.stationName}` : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedDevice ? (
            <div className="rounded-3xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--card)_84%,rgba(14,18,28,0.12))] p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                {selectedDevice.deviceName}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    <PrinterIcon className="h-4 w-4" />
                    Printer
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]">
                    {selectedDevice.printerName ?? "No printer connected"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    <DevicesIcon className="h-4 w-4" />
                    Group
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]">
                    {selectedDevice.deviceGroupName ?? "No device group"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    <StationsIcon className="h-4 w-4" />
                    Station
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]">
                    {selectedDevice.stationName
                      ? `${selectedDevice.stationName} (${selectedDevice.stationType})`
                      : "No station connected"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted-foreground)]">
              {devices.length === 0
                ? "No devices exist yet. You can continue without setup, then create them in Management -> Devices."
                : "Choose a saved device to continue."}
            </div>
          )}

          {error ? (
            <div className="text-sm text-[var(--destructive)]">{error}</div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            className="min-w-[180px]"
            onClick={() => selectedDevice && onConfigured(selectedDevice)}
            disabled={loading || (devices.length > 0 && !selectedDevice)}
          >
            Continue
          </Button>
          {devices.length === 0 ? (
            <Button size="lg" variant="ghost" onClick={onSkip}>
              Continue without device
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
