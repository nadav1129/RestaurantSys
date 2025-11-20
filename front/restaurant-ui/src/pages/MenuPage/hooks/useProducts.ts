// src/pages/MenuPage/hooks/useProducts.ts
import { useEffect, useState } from "react";
import { apiFetch } from "../../../api/api";

export type Product = {
  id?: string;
  productId?: string;
  name: string;
  price?: number;
};

export type ProductListItem = {
  id: string;   // product_id
  name: string;
  type?: string; // optional
};

/**
 * Handles product search per node (catalog), plus global "all products" and
 * the products already linked to a specific node.
 */
export default function useProducts(selectedNodeId: string | null) {
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<ProductListItem[]>([]);
  const [nodeProducts, setNodeProducts] = useState<ProductListItem[]>([]);

  // Catalog for the selected node (respects search)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!selectedNodeId) {
          if (!cancelled) setCatalog([]);
          return;
        }

        const q = search.trim();
        const base = '/api/products?menuNodeId=${encodeURIComponent(selectedNodeId)}';
        const url = q ? '${base}&search=${encodeURIComponent(q)}' : base;

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
  }, [search, selectedNodeId]);

  // Load ALL products (bank) whenever search changes (optional global search)
  useEffect(() => {
    void fetchAllProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load products linked to the selected node
  useEffect(() => {
    void fetchProductsForNode(selectedNodeId);
  }, [selectedNodeId]);

  async function fetchAllProducts(search?: string) {
  const trimmed = search?.trim();
  const q = trimmed ? `?q=${encodeURIComponent(trimmed)}` : "";
  const data = await apiFetch(`/api/products${q}`);
  setAllProducts(Array.isArray(data) ? data : []);
}


async function fetchProductsForNode(nodeId: string | null) {
  if (!nodeId) {
    // When nothing selected, do NOT touch nodeProducts and definitely do not overwrite catalog.
    setNodeProducts([]);
    return;
  }
  const data = await apiFetch('/api/menu-nodes/${nodeId}/products');
  setNodeProducts(Array.isArray(data) ? data : []);
}


  async function linkProductToNode(productId: string, nodeId: string) {
    await apiFetch('/api/menu-nodes/${nodeId}/products', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
  }

  // Use this in the catalog item to start a drag operation
  function onDragStartProduct(e: React.DragEvent, p: Product) {
    const pid = String(p.productId ?? p.id ?? "");
    e.dataTransfer?.setData("product-id", pid);            // <-- must be "product-id"
    e.dataTransfer?.setData("product-name", p.name);       // <-- must be "product-name"
    e.dataTransfer?.setData(
      "product-price",
      typeof p.price === "number" ? String(p.price) : ""
    ); // <-- must be "product-price"
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }


  return {
    // state
    search,
    setSearch,
    catalog,
    allProducts,
    nodeProducts,

    // ops
    fetchAllProducts,
    fetchProductsForNode,
    linkProductToNode,
    onDragStartProduct,
  };
}
