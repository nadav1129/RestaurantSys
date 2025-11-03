// File: MenuPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import MenuTree, { type MenuNode } from "../components/MenuTree";
import AddProductModal from "../components/AddProductModal";
import { apiFetch } from "../api/api";

/* ---------- Types ---------- */
export interface Product {
  id?: string;
  productId?: string;
  name: string;
  price?: number;
}

type MenuSummary = { menuNum: number; name: string };

type NodeDto = {
  id: string;
  parentId: string | null;
  name: string;
  isLeaf: boolean;
  sortOrder?: number;
};

type NodeInternal = {
  id: string;
  parentId: string | null;
  name: string;
  isLeaf: boolean;
  children: NodeInternal[];
  sortOrder?: number;
};

type MenuItemRow = {
  menuItemId: string;
  productId: string;
  productName: string;
  price: number;
  _dirty?: boolean; // local flag for unsaved edits
  _new?: boolean;   // local flag for newly dropped (not saved yet)
};

/* ---------- Tree helpers ---------- */
function buildTreeFromFlat(dtos: NodeDto[]): MenuNode[] {
  const byId = new Map<string, NodeInternal>();
  for (const d of dtos) {
    const parent =
      typeof d.parentId === "string" ? d.parentId.trim() || null : null;
    byId.set(d.id, {
      id: d.id,
      parentId: parent,
      name: d.name,
      isLeaf: d.isLeaf,
      children: [],
      sortOrder: d.sortOrder,
    });
  }
  const roots: NodeInternal[] = [];
  for (const n of byId.values()) {
    if (n.parentId === null) roots.push(n);
    else {
      const p = byId.get(n.parentId);
      if (p) p.children.push(n);
      else roots.push(n);
    }
  }
  const sortRec = (arr: NodeInternal[]) => {
    arr.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  const toPub = (arr: NodeInternal[]): MenuNode[] =>
    arr.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      name: n.name,
      isLeaf: n.children.length === 0,
      children: toPub(n.children),
    }));
  return toPub(roots);
}

function findNode(nodes: MenuNode[], id: string | null): MenuNode | null {
  if (!id) return null;
  for (const n of nodes) {
    if (n.id === id) return n;
    const f = n.children && findNode(n.children, id);
    if (f) return f;
  }
  return null;
}

function containsNodeId(arr: MenuNode[], id: string | null): boolean {
  if (!id) return false;
  const stack: MenuNode[] = [...arr];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return true;
    if (n.children && n.children.length) stack.push(...n.children);
  }
  return false;
}


/* ---------- Page ---------- */
export default function MenuPage() {
  /* MENUS */
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);

  /* TREE */
  const [nodes, setNodes] = useState<MenuNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  /* PRODUCT CATALOG (left panel) */
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  /* MENU & PRICING (big panel) */
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const selectedNode = useMemo(
    () => findNode(nodes, selectedNodeId),
    [nodes, selectedNodeId]
  );

  useEffect(() => {
  setSelectedNodeId(null);
  setNodes([]); // optional: prevents flicker from previous menu
}, [selectedMenu]);

  /* ---------- Load menus ---------- */
  useEffect(() => {
  (async () => {
    try {
      const data = await apiFetch("/api/menus");
      const list = (Array.isArray(data) ? data : []) as any[];
      const normalized: MenuSummary[] = list.map((m) => ({
        menuNum: Number(m.menuNum ?? m.MenuNum ?? m.id ?? 0),
        name: String(m.name ?? m.MenuName ?? `Menu ${m.menuNum ?? ""}`),
      })).filter(m => m.menuNum > 0);
      setMenus(normalized);
      if (!selectedMenu && normalized.length) {
        setSelectedMenu(normalized[0].menuNum);
      }
    } catch {
      setMenus([]);
    }
  })();
}, []);

  /* ---------- Load tree for selected menu ---------- */
  useEffect(() => {
    if (!selectedMenu) {
      setNodes([]);
      setSelectedNodeId(null);
      return;
    }
    (async () => {
    try {
      const data = await apiFetch(`/api/menu-nodes?menu=${selectedMenu}`);
      const arr = Array.isArray(data) ? (data as any[]) : [];
      const isNested = arr.length && (arr[0].children || arr[0].Children);
      if (isNested) {
        const mapNode = (s: any): MenuNode => ({
          id: String(s.id ?? s.Id ?? ""),
          parentId:
            s.parentId == null && s.ParentId == null
              ? null
              : String(s.parentId ?? s.ParentId),
          name: String(s.name ?? s.Name ?? ""),
          isLeaf: Boolean(s.isLeaf ?? s.IsLeaf ?? false),
          children: (s.children ?? s.Children ?? []).map(mapNode),
        });
        setNodes(arr.map(mapNode));
      } else {
        setNodes(buildTreeFromFlat(arr as NodeDto[]));
      }
    } catch {
      setNodes([]);
    }
  })();
  }, [selectedMenu]);;

  /* ---------- Load existing menu items (for big panel) ---------- */
  useEffect(() => {
    (async () => {
      if (!selectedMenu) {
        setMenuItems([]);
        return;
      }
      setIsLoadingItems(true);
      try {
        const qs =
          selectedNodeId && selectedNode
            ? `menuId=${encodeURIComponent(selectedMenu)}&menuNodeId=${encodeURIComponent(
                selectedNodeId
              )}`
            : `menuId=${encodeURIComponent(selectedMenu)}`;
        const data = await apiFetch(`/api/menu-items?${qs}`);
        const rows: MenuItemRow[] = (Array.isArray(data) ? data : []).map(
          (r: any) => ({
            menuItemId: String(r.menuItemId ?? r.id ?? r.Id ?? ""),
            productId: String(r.productId ?? r.ProductId ?? ""),
            productName: String(r.productName ?? r.ProductName ?? r.name ?? ""),
            price: Number(r.price ?? r.Price ?? 0),
          })
        );
        setMenuItems(rows);
      } catch {
        setMenuItems([]);
      } finally {
        setIsLoadingItems(false);
      }
    })();
  }, [selectedMenu, selectedNodeId]);

  /* ---------- Product catalog search ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = search.trim();
        const url = q ? `/api/products?search=${encodeURIComponent(q)}` : `/api/products`;
        const data = await apiFetch(url);
        if (!cancelled) {
          const list: Product[] = (Array.isArray(data) ? data : []).map((p: any) => ({
            id: String(p.id ?? p.productId ?? ""),
            productId: String(p.productId ?? p.id ?? ""),
            name: String(p.name ?? ""),
            price: typeof p.price === "number" ? p.price : undefined,
          }));
          setCatalog(list);
        }
      } catch {
        if (!cancelled) setCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search]);

  /* ---------- Actions ---------- */
  /* Handles the creation of a new menu - request the api to post new menu in menus */
  async function handleCreateMenu() {
  const name = window.prompt("Menu name?");
  if (!name?.trim()) return;
  try {
    //console.debug("POST /api/menus body", { name: "My menu" }); 
    console.debug("POST /api/menus body", { name: name.trim() }); 
    const created = await apiFetch("/api/menus", {
      method: "POST",
      body: JSON.stringify({ "name": name.trim() }),
    });
    const menuNum = Number(created?.menuNum ?? created?.MenuNum ?? 0);
    const rec = { menuNum, name: created?.name ?? name.trim() };
    if (menuNum > 0) {
      setMenus((m) => [...m, rec]);
      setSelectedMenu(menuNum);
    }
  } catch (e) {
    console.error("Create menu failed", e);
  }
}

  async function handleRenameMenu() {
    if (!selectedMenu) return;
    const current = menus.find((m) => m.menuNum === selectedMenu)?.name ?? "";
    const name = window.prompt("New menu name?", current);
    if (!name || !name.trim()) return;
    try {
      await apiFetch(`/api/menus/${selectedMenu}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setMenus((ms) => ms.map((m) => (m.menuNum === selectedMenu ? { ...m, name: name.trim() } : m)));
    } catch (e) {
      console.error("Rename menu failed", e);
      alert("Rename failed");
    }
  }

  async function handleDeleteMenu() {
    if (!selectedMenu) return;
    if (!window.confirm("Delete this menu? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/menus/${selectedMenu}`, { method: "DELETE" });
      const remaining = menus.filter((m) => m.menuNum !== selectedMenu);
      setMenus(remaining);
      const newSel = remaining.length ? remaining[0].menuNum : null;
      setSelectedMenu(newSel);
      if (newSel) localStorage.setItem("selectedMenu", String(newSel));
      else localStorage.removeItem("selectedMenu");
    } catch (e) {
      console.error("Delete menu failed", e);
      alert("Delete failed");
    }
  }

  // REPLACE handleCreateNode with:
async function handleCreateNode() {
  if (!selectedMenu) return;
  const name = window.prompt("New category/leaf name?");
  if (!name?.trim()) return;

  const candidateParent = selectedNodeId ?? null;
  const parentId = containsNodeId(nodes, candidateParent) ? candidateParent : null;

  try {
    await apiFetch("/api/menu-nodes", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        isLeaf: false,
        parentId: parentId,                               // null => attach under THIS menu's root
        MenuNum: parentId ? undefined : selectedMenu,     // REQUIRED at root
      }),
    });

    // reload tree for this menu
    const data = await apiFetch(`/api/menu-nodes?menu=${selectedMenu}`);
    const arr = Array.isArray(data) ? (data as any[]) : [];
    const isNested = arr.length && (arr[0].children || arr[0].Children);
    if (isNested) {
      const mapNode = (s: any): MenuNode => ({
        id: String(s.id ?? s.Id ?? ""),
        parentId:
          s.parentId == null && s.ParentId == null
            ? null
            : String(s.parentId ?? s.ParentId),
        name: String(s.name ?? s.Name ?? ""),
        isLeaf: Boolean(s.isLeaf ?? s.IsLeaf ?? false),
        children: (s.children ?? s.Children ?? []).map(mapNode),
      });
      setNodes(arr.map(mapNode));
    } else {
      setNodes(buildTreeFromFlat(arr as NodeDto[]));
    }
  } catch (e) {
    console.error("Create node failed", e);
  }
}


  /* ---------- Big panel: DnD & pricing ---------- */
  function onDragStartProduct(e: React.DragEvent, p: Product) {
    e.dataTransfer.setData("product-id", String(p.productId ?? p.id));
    e.dataTransfer.setData("product-name", p.name);
    e.dataTransfer.setData(
      "product-price",
      typeof p.price === "number" ? String(p.price) : ""
    );
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDropIntoPricing(e: React.DragEvent) {
    e.preventDefault();
    const productId = e.dataTransfer.getData("product-id");
    const productName = e.dataTransfer.getData("product-name") || "(product)";
    const priceRaw = e.dataTransfer.getData("product-price");
    const defaultPrice = priceRaw ? Number(priceRaw) : 0;

    if (!productId) return;

    // Stage a NEW unsaved row
    setMenuItems((rows) => [
      ...rows,
      {
        menuItemId: "", // not saved yet
        productId: productId,
        productName,
        price: defaultPrice,
        _dirty: true,
        _new: true,
      },
    ]);
  }

  async function saveRow(row: MenuItemRow) {
    if (!selectedMenu) return;
    // If this is a new association → POST; else PATCH
    if (row._new) {
      const body = {
        menuId: selectedMenu,
        nodeId: selectedNodeId ?? null, // put under currently selected node; null => root
        productId: row.productId,
        price: row.price,
      };
      try {
        const created = await apiFetch("/api/menu-items", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const newId = String(created?.menuItemId ?? created?.id ?? "");
        setMenuItems((rows) =>
          rows.map((r) =>
            r === row
              ? {
                  ...r,
                  menuItemId: newId || r.menuItemId,
                  _dirty: false,
                  _new: false,
                }
              : r
          )
        );
      } catch (e) {
        console.error("POST /api/menu-items failed", e);
      }
    } else {
      try {
        await apiFetch(`/api/menu-items/${row.menuItemId}`, {
          method: "PATCH",
          body: JSON.stringify({ price: row.price }),
        });
        setMenuItems((rows) =>
          rows.map((r) => (r === row ? { ...r, _dirty: false } : r))
        );
      } catch (e) {
        console.error("PATCH /api/menu-items failed", e);
      }
    }
  }

  async function removeRow(row: MenuItemRow) {
    if (row._new) {
      // Just drop it from UI
      setMenuItems((rows) => rows.filter((r) => r !== row));
      return;
    }
    try {
      await apiFetch(`/api/menu-items/${row.menuItemId}`, { method: "DELETE" });
      setMenuItems((rows) => rows.filter((r) => r !== row));
    } catch (e) {
      console.error("DELETE /api/menu-items failed", e);
    }
  }

  /* ---------- Render ---------- */
  return (
  <div className="mx-auto max-w-7xl px-4 py-6">
    {/* Top bar: select/create menu */}
    <div className="mb-4 flex items-center gap-2">
      <select
        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
        value={selectedMenu ?? ""}
        onChange={(e) => {
        const v = e.target.value ? Number(e.target.value) : null;
        setSelectedMenu(v);
        setSelectedNodeId(null); // <<< prevent stale root from previous menu
        }}
      >
        {menus.map((m) => (
          <option key={m.menuNum} value={m.menuNum}>
            {m.name || `Menu ${m.menuNum}`}
          </option>
        ))}
      </select>
      <button
        onClick={handleCreateMenu}
        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        + New Menu
      </button>
      <button
        onClick={handleRenameMenu}
        disabled={!selectedMenu}
        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Edit Menu
      </button>
      <button
        onClick={handleDeleteMenu}
        disabled={!selectedMenu}
        className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Delete Menu
      </button>
    </div>

    {/* Row: Product Catalog (left) + Menu Structure (right) */}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Product Catalog */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-gray-500">Product Catalog</div>
            <div className="text-lg font-semibold text-gray-800">Create & Search</div>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
          >
            + Add Product
          </button>
        </div>

        <div className="mb-3">
          <input
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {catalog.map((p) => (
            <div
              key={p.productId ?? p.id}
              draggable
              onDragStart={(e) => onDragStartProduct(e, p)}
              className="cursor-grab rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-xs"
              title="Drag into the Menu & Pricing panel"
            >
              {p.name}
              {typeof p.price === "number" ? ` • ₪${p.price}` : ""}
            </div>
          ))}
          {catalog.length === 0 && (
            <div className="text-sm text-gray-400">(no products)</div>
          )}
        </div>
      </div>

      {/* Menu Structure */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500">Menu Structure</div>
            <div className="text-lg font-semibold text-gray-800">Build your tree</div>
            <div className="mt-1 text-xs text-gray-500">
              Target:{" "}
              {selectedNode ? (
                <>
                  inside <span className="font-medium">“{selectedNode.name}”</span>
                </>
              ) : (
                "root"
              )}
            </div>
          </div>
          <button
            onClick={handleCreateNode}
            disabled={!selectedMenu}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            + Add Node
          </button>
        </div>

        <div className="min-h-[260px]">
          {nodes.length === 0 ? (
            <div className="text-sm text-gray-400">(no categories yet)</div>
          ) : (
            <MenuTree
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          )}
        </div>
      </div>
    </div>

    {/* Big panel: Menu & Pricing */}
    <div
      className="mt-4 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-4"
      onDragOver={allowDrop}
      onDrop={handleDropIntoPricing}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-gray-600">Menu & Pricing</div>
          <div className="text-lg font-semibold text-gray-900">
            {menus.find((m) => m.menuNum === selectedMenu)?.name ?? "—"}
            <span className="ml-2 text-sm font-normal text-gray-600">
              • {selectedNode ? `Section: ${selectedNode.name}` : "Root"}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Tip: drag products from the left panel and drop here to stage them, then set a price and Save.
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full table-fixed">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="w-8 px-3 py-2">#</th>
              <th className="px-3 py-2">Product</th>
              <th className="w-40 px-3 py-2">Price (₪)</th>
              <th className="w-40 px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingItems ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : menuItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">
                  Drag products here to start building your menu.
                </td>
              </tr>
            ) : (
              menuItems.map((row, idx) => (
                <tr
                  key={(row.menuItemId || row.productId) + ":" + idx}
                  className="border-t border-gray-100 text-sm"
                >
                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                  <td className="truncate px-3 py-2 font-medium text-gray-800">
                    {row.productName}
                    {row._new && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        NEW
                      </span>
                    )}
                    {row._dirty && !row._new && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                        Edited
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={row.price}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMenuItems((rs) =>
                          rs.map((r) => (r === row ? { ...r, price: v, _dirty: true } : r))
                        );
                      }}
                      className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveRow(row)}
                        disabled={!row._dirty}
                        className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => removeRow(row)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Current target for new items:{" "}
        <span className="font-semibold">
          {selectedNode ? selectedNode.name : "Root"}
        </span>
        . You’ll add direct selection inside this panel later (as you said).
      </div>
    </div>

    {isAddOpen && (
      <AddProductModal
        defaultNodeId={selectedNode?.id ?? ""}
        defaultMenuId={selectedMenu?.toString()}
        onClose={() => setIsAddOpen(false)}
        onSave={async (p) => {
          try {
            await apiFetch("/api/products", {
              method: "POST",
              body: JSON.stringify({
                name: p.name,
                price: p.price,
                type: p.isBottleOnly ? "Bottle" : "Cocktail",
                components: p.lines.map((l) => ({
                  ingredientId: l.ingredientId,
                  amountMl: parseFloat(l.amount || "0"),
                  isLeading: l.isLeading,
                  isChangeable: l.isChangeable,
                })),
              }),
            });
          } catch (e) {
            console.error("Create product failed", e);
          } finally {
            setIsAddOpen(false);
          }
          // refresh catalog
          try {
            const data = await apiFetch("/api/products");
            const list: Product[] = (Array.isArray(data) ? data : []).map((p: any) => ({
              id: String(p.id ?? p.productId ?? ""),
              productId: String(p.productId ?? p.id ?? ""),
              name: String(p.name ?? ""),
              price: typeof p.price === "number" ? p.price : undefined,
            }));
            setCatalog(list);
          } catch {
            /* no-op */
          }
        }}
      />
    )}
  </div>
);
}
