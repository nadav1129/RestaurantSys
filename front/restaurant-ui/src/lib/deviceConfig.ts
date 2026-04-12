import type { ManagedDevice } from "../types";

const STORAGE_KEY = "restaurant:selected-device";

export type StoredDeviceConfig = {
  deviceId: string;
  deviceName: string;
  stationId?: string | null;
  stationName?: string | null;
};

export function loadStoredDeviceConfig(): StoredDeviceConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredDeviceConfig | null;
    if (!parsed?.deviceId || !parsed?.deviceName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredDeviceConfig(
  device: Pick<ManagedDevice, "deviceId" | "deviceName" | "stationId" | "stationName">
): StoredDeviceConfig {
  const next: StoredDeviceConfig = {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    stationId: device.stationId ?? null,
    stationName: device.stationName ?? null,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearStoredDeviceConfig() {
  window.localStorage.removeItem(STORAGE_KEY);
}
