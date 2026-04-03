import { useState } from "react";
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
import useMenuDialogs from "./components/MenuDialogs";
import { SectionCard } from "../../components/ui/layout";

export default function MenuPage() {
  const menuDialogs = useMenuDialogs();
  const { Dialogs } = menuDialogs;
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(false);

  const {
    menus,
    selectedMenu,
    selectedMenuName,
    setSelectedMenu,
    createMenu,
    renameMenu,
    deleteMenu,
  } = useMenus(menuDialogs);

  const {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    createNode,
    renameNode,
    deleteNode,
  } = useMenuTree(selectedMenu, menuDialogs);

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
  } = useMenuItems(selectedMenu, selectedNodeId, menuDialogs);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Menu Builder"
        description="Manage menu sets, product search, structure, and pricing from one quieter workspace."
      >
        <MenuTopBar
          menus={menus}
          selectedMenu={selectedMenu}
          onSelect={(menuNum) => {
            setSelectedMenu(menuNum);
            setSelectedNodeId(null);
          }}
          onCreate={createMenu}
          onRename={async () => {
            const name = (
              await menuDialogs.prompt("New name?", {
                title: "Rename Menu",
                defaultValue: selectedMenuName ?? "",
              })
            )?.trim();
            if (name) renameMenu(name);
          }}
          onDelete={deleteMenu}
        />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
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

      {isAddOpen && (
        <AddProductModal
          onClose={() => setIsAddOpen(false)}
          onSave={async (p) => {
            try {
              await apiFetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: {
                  name: p.name,
                  type: p.isBottleOnly ? "bottle" : p.productType,
                  soldAsBottleOnly: !!p.isBottleOnly,
                  menuNodeId: null,
                  components: p.lines.map((l) => ({
                    ingredientId: l.ingredientId,
                    amountMl: parseFloat(l.amount || "0"),
                    isLeading: l.isLeading,
                    isChangeable: l.isChangeable,
                  })),
                },
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

      <Dialogs />
    </div>
  );
}
