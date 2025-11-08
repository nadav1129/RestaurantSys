// src/pages/MenuPage/hooks/useMenus.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../api/api";

export type MenuSummary = { menuNum: number; name: string };

function normalizeMenus(data: any[]): MenuSummary[] {
  return data
    .map((m) => ({
      menuNum: Number(m.menuNum ?? m.MenuNum ?? m.id ?? 0),
      name: String(m.name ?? m.MenuName ?? `Menu ${m.menuNum ?? ""}`),
    }))
    .filter((m) => m.menuNum > 0);
}

export default function useMenus() {
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- initial selected from localStorage ---------- */
  useEffect(() => {
    const persisted = Number(localStorage.getItem("selectedMenu") || "");
    if (!Number.isNaN(persisted) && persisted > 0) {
      setSelectedMenu(persisted);
    }
  }, []);

  /* ---------- load menus ---------- */
  const refreshMenus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/menus");
      const list = Array.isArray(data) ? data : [];
      const normalized = normalizeMenus(list);
      setMenus(normalized);

      // keep current selection if it still exists; else fallback to first
      if (normalized.length === 0) {
        setSelectedMenu(null);
        localStorage.removeItem("selectedMenu");
      } else if (
        !selectedMenu ||
        !normalized.some((m) => m.menuNum === selectedMenu)
      ) {
        const next = normalized[0].menuNum;
        setSelectedMenu(next);
        localStorage.setItem("selectedMenu", String(next));
      }
    } catch (e: any) {
      setMenus([]);
      setError(e?.message ?? "Failed to load menus");
    } finally {
      setLoading(false);
    }
  }, [selectedMenu]);

  useEffect(() => {
    void refreshMenus();
  }, [refreshMenus]);

  /* ---------- actions ---------- */
  const createMenu = useCallback(async () => {
    const name = window.prompt("Menu name?");
    if (!name?.trim()) return;

    try {
      const created = await apiFetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const menuNum = Number(created?.menuNum ?? created?.MenuNum ?? 0);
      const rec: MenuSummary = {
        menuNum,
        name: String(created?.name ?? name.trim()),
      };

      if (menuNum > 0) {
        setMenus((m) => [...m, rec]);
        setSelectedMenu(menuNum);
        localStorage.setItem("selectedMenu", String(menuNum));
      }
    } catch (e) {
      console.error("Create menu failed", e);
      setError("Create menu failed");
    }
  }, []);

  const renameMenu = useCallback(
    async (nextName: string) => {
      if (!selectedMenu) return;
      const name = nextName.trim();
      if (!name) return;

      try {
        const updated = await apiFetch(`/api/menus/${selectedMenu}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });

        const updatedNum = Number(updated?.menuNum ?? updated?.MenuNum ?? selectedMenu);
        const updatedName = String(updated?.name ?? name);

        setMenus((prev) =>
          prev.map((m) => (m.menuNum === updatedNum ? { ...m, name: updatedName } : m))
        );
      } catch (e) {
        console.error("Rename menu failed", e);
        setError("Rename menu failed");
      }
    },
    [selectedMenu]
  );

  const deleteMenu = useCallback(async () => {
    if (!selectedMenu) return;
    if (!window.confirm("Delete this menu? This cannot be undone.")) return;

    try {
      await apiFetch(`/api/menus/${selectedMenu}`, { method: "DELETE" });

      setMenus((prev) => prev.filter((m) => m.menuNum !== selectedMenu));

      // choose a new selection
      setSelectedMenu((prevSelected) => {
        const remaining = menus.filter((m) => m.menuNum !== prevSelected);
        const next = remaining.length ? remaining[0].menuNum : null;
        if (next) localStorage.setItem("selectedMenu", String(next));
        else localStorage.removeItem("selectedMenu");
        return next;
      });
    } catch (e) {
      console.error("Delete menu failed", e);
      setError("Delete menu failed");
      alert("Delete failed");
    }
  }, [menus, selectedMenu]);

  /* ---------- persist selection ---------- */
  useEffect(() => {
    if (selectedMenu) localStorage.setItem("selectedMenu", String(selectedMenu));
  }, [selectedMenu]);

  const selectedMenuName = useMemo(
    () => menus.find((m) => m.menuNum === selectedMenu)?.name ?? null,
    [menus, selectedMenu]
  );

  return {
    // data
    menus,
    selectedMenu,
    selectedMenuName,

    // state
    loading,
    error,

    // setters
    setSelectedMenu,
    setMenus,

    // actions
    refreshMenus,
    createMenu,
    renameMenu,
    deleteMenu,
  };
}
