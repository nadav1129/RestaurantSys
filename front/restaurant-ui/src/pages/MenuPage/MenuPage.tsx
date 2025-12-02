import React, { useState } from "react";
import AddProductModal from "../../components/AddProductModal";
import IngredientManager from "../../components/ingredient_manager";

import MenuTopBar from "./panels/MenuTopBar";
import ProductCatalogPanel from "./panels/ProductCatalogPanel";
import MenuStructurePanel from "./panels/MenuStructurePanel";
import MenuPricingPanel from "./panels/MenuPricingPanel";

import useMenus from "./hooks/useMenus";
import useMenuTree from "./hooks/useMenuTree";
import useProducts from "./hooks/useProducts";
import useMenuItems from "./hooks/useMenuItems";
import { apiFetch } from "../../api/api";

/**
 * The main orchestration component for the Menu page.
 * Handles overall layout and interaction between panels.
 */
export default function MenuPage() {
  /* ---------------- State for modals ---------------- */
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(false);

  /* ---------------- Custom Hooks ---------------- */
  const { menus, selectedMenu, setSelectedMenu, createMenu, renameMenu, deleteMenu } =
    useMenus();

  const {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    createNode,
    renameNode,
    deleteNode,
  } = useMenuTree(selectedMenu);

  const {
    search,
    setSearch,
    catalog,
    onDragStartProduct,
    fetchProductsForNode,
    fetchAllProducts, 
  } = useProducts(selectedNodeId);

  const {
    menuItems,
    isLoadingItems,
    setMenuItems,
    allowDrop,
    handleDropIntoPricing,
    saveRow,
    removeRow,
  } = useMenuItems(selectedMenu, selectedNodeId);

  /* ---------------- UI ---------------- */
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Top bar: select/create/edit/delete menu */}
      <MenuTopBar
        menus={menus}
        selectedMenu={selectedMenu}
        onSelect={(menuNum) => {
          setSelectedMenu(menuNum);
          setSelectedNodeId(null);
        }}
        onCreate={createMenu}
        onRename={() => {
          const name = window.prompt("New name?")?.trim();
          if (name) renameMenu(name);
        }}
        onDelete={deleteMenu}
      />
      {/* Two panels: Product Catalog + Menu Structure */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductCatalogPanel
          search={search}
          setSearch={setSearch}
          catalog={catalog}
          onDragStartProduct={onDragStartProduct}
          onOpenAddProduct={() => setIsAddOpen(true)}
          onOpenIngredients={() => setIsIngredientsOpen(true)}
        />

        <MenuStructurePanel
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          selectedMenu={selectedMenu}
          selectedNodeName={selectedNode?.name ?? null}
          onCreateNode={createNode}
          onRenameNode={renameNode}
          onDeleteNode={deleteNode}
        />
      </div>

      {/* Pricing panel */}
      <MenuPricingPanel
        menuName={menus.find((m) => m.menuNum === selectedMenu)?.name ?? "—"}
        sectionLabel={selectedNode ? `Section: ${selectedNode.name}` : "Root"}
        menuItems={menuItems}
        isLoadingItems={isLoadingItems}
        setMenuItems={setMenuItems}
        allowDrop={allowDrop}
        handleDropIntoPricing={handleDropIntoPricing}
        saveRow={saveRow}
        removeRow={removeRow}
      />

      {/* ---------- Modals ---------- */}
      {isAddOpen && (
        <AddProductModal
          onClose={() => setIsAddOpen(false)}
          onSave={async (p) => {
            try {
              // Create product
              const resp = await apiFetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: p.name,
                  type: p.isBottleOnly? "bottle" : p.productType,
                  soldAsBottleOnly: !!p.isBottleOnly,
                  menuNodeId: null,
                  components: p.lines.map((l) => ({
                    ingredientId: l.ingredientId,
                    amountMl: parseFloat(l.amount || "0"),
                    isLeading: l.isLeading,
                    isChangeable: l.isChangeable,
                  })),
                }),
              });
              await fetchAllProducts(); 
              await fetchProductsForNode(selectedNodeId);
              setIsAddOpen(false);
            } catch (err) {
              console.error("Create product failed", err);
            }
          }}
        />
      )}

      {isIngredientsOpen && (
        <IngredientManager
          open={isIngredientsOpen}
          onClose={() => setIsIngredientsOpen(false)}
        />
      )}
    </div>
  );
}
