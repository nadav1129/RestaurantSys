import { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import { apiFetch } from "../../api/api";
import { DevicesIcon, PrinterIcon, StationsIcon } from "../../components/icons";
import {
  EmptyState,
  SectionCard,
  StatCard,
} from "../../components/ui/layout";
import type { DeviceGroup, ManagedDevice, Printer, Station } from "../../types";

type DeviceDraftMap = Record<
  string,
  {
    deviceName: string;
    printerId: string;
    deviceGroupId: string;
  }
>;

export default function DevicesPage() {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [deviceDrafts, setDeviceDrafts] = useState<DeviceDraftMap>({});

  const [newPrinterName, setNewPrinterName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupStationId, setNewGroupStationId] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDevicePrinterId, setNewDevicePrinterId] = useState("");
  const [newDeviceGroupId, setNewDeviceGroupId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [devicesResp, printersResp, groupsResp, stationsResp] =
        await Promise.all([
          apiFetch("/api/devices"),
          apiFetch("/api/printers"),
          apiFetch("/api/device-groups"),
          apiFetch("/api/stations"),
        ]);

      setDevices(Array.isArray(devicesResp) ? (devicesResp as ManagedDevice[]) : []);
      setPrinters(Array.isArray(printersResp) ? (printersResp as Printer[]) : []);
      setGroups(Array.isArray(groupsResp) ? (groupsResp as DeviceGroup[]) : []);
      setStations(Array.isArray(stationsResp) ? (stationsResp as Station[]) : []);
    } catch (e) {
      console.error("Failed to load devices page", e);
      setError("Failed to load devices, printers, or groups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setDeviceDrafts((prev) => {
      const next: DeviceDraftMap = {};
      for (const device of devices) {
        next[device.deviceId] = prev[device.deviceId] ?? {
          deviceName: device.deviceName,
          printerId: device.printerId ?? "",
          deviceGroupId: device.deviceGroupId ?? "",
        };
      }
      return next;
    });
  }, [devices]);

  const unassignedDevices = useMemo(
    () => devices.filter((device) => !device.deviceGroupId).length,
    [devices]
  );

  async function handleCreatePrinter() {
    const printerName = newPrinterName.trim();
    if (!printerName) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch("/api/printers", {
        method: "POST",
        body: { printerName },
      });
      setNewPrinterName("");
      await load();
    } catch (e) {
      console.error("Failed to create printer", e);
      setError("Failed to create printer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePrinter(printerId: string, printerName: string) {
    const confirmed = window.confirm(
      `Delete printer "${printerName}"? Devices connected to it will be detached from this printer.`
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/printers/${printerId}`, { method: "DELETE" });
      await load();
    } catch (e) {
      console.error("Failed to delete printer", e);
      setError("Failed to delete printer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch("/api/device-groups", {
        method: "POST",
        body: {
          name,
          stationId: newGroupStationId || null,
        },
      });
      setNewGroupName("");
      setNewGroupStationId("");
      await load();
    } catch (e) {
      console.error("Failed to create device group", e);
      setError("Failed to create device group.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameGroup(group: DeviceGroup) {
    const nextName = window.prompt("Rename device group", group.name)?.trim();
    if (!nextName || nextName === group.name) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/device-groups/${group.deviceGroupId}`, {
        method: "PUT",
        body: {
          name: nextName,
          stationId: group.stationId ?? null,
        },
      });
      await load();
    } catch (e) {
      console.error("Failed to rename device group", e);
      setError("Failed to rename device group.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateGroupStation(group: DeviceGroup, stationId: string) {
    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/device-groups/${group.deviceGroupId}`, {
        method: "PUT",
        body: {
          name: group.name,
          stationId: stationId || null,
        },
      });
      await load();
    } catch (e) {
      console.error("Failed to update group station", e);
      setError("Failed to update group station.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(group: DeviceGroup) {
    const confirmed = window.confirm(
      `Delete device group "${group.name}"? Devices in it will be detached from the group.`
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/device-groups/${group.deviceGroupId}`, {
        method: "DELETE",
      });
      await load();
    } catch (e) {
      console.error("Failed to delete device group", e);
      setError("Failed to delete device group.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDevice() {
    const deviceName = newDeviceName.trim();
    if (!deviceName) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch("/api/devices", {
        method: "POST",
        body: {
          deviceName,
          printerId: newDevicePrinterId || null,
          deviceGroupId: newDeviceGroupId || null,
        },
      });
      setNewDeviceName("");
      setNewDevicePrinterId("");
      setNewDeviceGroupId("");
      await load();
    } catch (e) {
      console.error("Failed to create device", e);
      setError("Failed to create device.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDevice(deviceId: string) {
    const draft = deviceDrafts[deviceId];
    if (!draft?.deviceName.trim()) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/devices/${deviceId}`, {
        method: "PUT",
        body: {
          deviceName: draft.deviceName.trim(),
          printerId: draft.printerId || null,
          deviceGroupId: draft.deviceGroupId || null,
        },
      });
      await load();
    } catch (e) {
      console.error("Failed to save device", e);
      setError("Failed to save device.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDevice(device: ManagedDevice) {
    const confirmed = window.confirm(`Delete device "${device.deviceName}"?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/devices/${device.deviceId}`, { method: "DELETE" });
      await load();
    } catch (e) {
      console.error("Failed to delete device", e);
      setError("Failed to delete device.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Devices"
        description="Create fixed tablets, connect them to printers, and group them under stations."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Devices"
            value={devices.length}
            hint="Saved devices appear in the landing page selector when a tablet launches for the first time."
          />
          <StatCard
            label="Printers"
            value={printers.length}
            hint="A device can connect directly to any saved printer."
          />
          <StatCard
            label="Ungrouped Devices"
            value={unassignedDevices}
            hint="Group devices when several of them should inherit the same station."
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Device Registry"
          description="This list is used by the landing page during first-time setup."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="rs-input min-w-[220px]"
                placeholder="New device name"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
              <select
                className="rs-select min-w-[180px]"
                value={newDevicePrinterId}
                onChange={(e) => setNewDevicePrinterId(e.target.value)}
              >
                <option value="">No printer</option>
                {printers.map((printer) => (
                  <option key={printer.printerId} value={printer.printerId}>
                    {printer.printerName}
                  </option>
                ))}
              </select>
              <select
                className="rs-select min-w-[220px]"
                value={newDeviceGroupId}
                onChange={(e) => setNewDeviceGroupId(e.target.value)}
              >
                <option value="">No device group</option>
                {groups.map((group) => (
                  <option key={group.deviceGroupId} value={group.deviceGroupId}>
                    {group.name}
                    {group.stationName ? ` -> ${group.stationName}` : ""}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => void handleCreateDevice()}
                disabled={saving || !newDeviceName.trim()}
              >
                Add Device
              </Button>
            </div>
          }
        >
          {loading ? (
            <div className="text-sm text-[var(--muted-foreground)]">
              Loading devices...
            </div>
          ) : devices.length === 0 ? (
            <EmptyState
              title="No devices yet"
              description="Create a device here, then choose it from the landing page on the tablet."
            />
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const draft = deviceDrafts[device.deviceId] ?? {
                  deviceName: device.deviceName,
                  printerId: device.printerId ?? "",
                  deviceGroupId: device.deviceGroupId ?? "",
                };

                return (
                  <div
                    key={device.deviceId}
                    className="rounded-3xl border border-[var(--border)] bg-[var(--card-muted)] p-4"
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_220px_240px_auto] lg:items-start">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Device name
                        </label>
                        <input
                          className="rs-input"
                          value={draft.deviceName}
                          onChange={(e) =>
                            setDeviceDrafts((prev) => ({
                              ...prev,
                              [device.deviceId]: {
                                ...draft,
                                deviceName: e.target.value,
                              },
                            }))
                          }
                        />
                        <div className="text-sm text-[var(--muted-foreground)]">
                          {device.stationName
                            ? `Station: ${device.stationName} (${device.stationType})`
                            : "No station connected yet"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Printer
                        </label>
                        <select
                          className="rs-select"
                          value={draft.printerId}
                          onChange={(e) =>
                            setDeviceDrafts((prev) => ({
                              ...prev,
                              [device.deviceId]: {
                                ...draft,
                                printerId: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">No printer</option>
                          {printers.map((printer) => (
                            <option key={printer.printerId} value={printer.printerId}>
                              {printer.printerName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Device group
                        </label>
                        <select
                          className="rs-select"
                          value={draft.deviceGroupId}
                          onChange={(e) =>
                            setDeviceDrafts((prev) => ({
                              ...prev,
                              [device.deviceId]: {
                                ...draft,
                                deviceGroupId: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">No device group</option>
                          {groups.map((group) => (
                            <option key={group.deviceGroupId} value={group.deviceGroupId}>
                              {group.name}
                              {group.stationName ? ` -> ${group.stationName}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => void handleSaveDevice(device.deviceId)}
                          disabled={saving || !draft.deviceName.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void handleDeleteDevice(device)}
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Printers"
            description="Add the printers devices can target."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="rs-input min-w-[220px]"
                  placeholder="New printer name"
                  value={newPrinterName}
                  onChange={(e) => setNewPrinterName(e.target.value)}
                />
                <Button
                  onClick={() => void handleCreatePrinter()}
                  disabled={saving || !newPrinterName.trim()}
                >
                  Add Printer
                </Button>
              </div>
            }
          >
            {printers.length === 0 ? (
              <EmptyState
                title="No printers yet"
                description="Create a printer here so devices can connect to it."
              />
            ) : (
              <div className="space-y-2">
                {printers.map((printer) => (
                  <div
                    key={printer.printerId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                        <PrinterIcon className="h-4.5 w-4.5" />
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        {printer.printerName}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void handleDeletePrinter(printer.printerId, printer.printerName)
                      }
                      disabled={saving}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Device Groups"
            description="Attach a group to a station, then connect several devices to that group."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="rs-input min-w-[200px]"
                  placeholder="New group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <select
                  className="rs-select min-w-[220px]"
                  value={newGroupStationId}
                  onChange={(e) => setNewGroupStationId(e.target.value)}
                >
                  <option value="">No station yet</option>
                  {stations.map((station) => (
                    <option key={station.stationId} value={station.stationId}>
                      {station.stationName} ({station.stationType})
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => void handleCreateGroup()}
                  disabled={saving || !newGroupName.trim()}
                >
                  Add Group
                </Button>
              </div>
            }
          >
            {groups.length === 0 ? (
              <EmptyState
                title="No groups yet"
                description="Create a group when multiple tablets should all route to the same station."
              />
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.deviceGroupId}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                          <DevicesIcon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--foreground)]">
                            {group.name}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {group.deviceCount} device{group.deviceCount === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                          <StationsIcon className="h-4 w-4 text-[var(--muted-foreground)]" />
                          <select
                            className="bg-transparent text-sm text-[var(--foreground)] outline-none"
                            value={group.stationId ?? ""}
                            onChange={(e) =>
                              void handleUpdateGroupStation(group, e.target.value)
                            }
                            disabled={saving}
                          >
                            <option value="">No station connected</option>
                            {stations.map((station) => (
                              <option key={station.stationId} value={station.stationId}>
                                {station.stationName} ({station.stationType})
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => void handleRenameGroup(group)}
                          disabled={saving}
                        >
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => void handleDeleteGroup(group)}
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
