
type MenuSummary = { menuNum: number; name: string };

export default function MenuTopBar({
  menus,
  selectedMenu,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  menus: MenuSummary[];
  selectedMenu: number | null;
  onSelect: (menuNum: number | null) => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <select
        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
        value={selectedMenu ?? ""}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : null;
          onSelect(v);
        }}
      >
        {menus.map((m) => (
          <option key={m.menuNum} value={m.menuNum}>
            {m.name || `Menu ${m.menuNum}`}
          </option>
        ))}
      </select>

      <button
        onClick={onCreate}
        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        + New Menu
      </button>

      <button
        onClick={onRename}
        disabled={selectedMenu === null}
        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Edit Menu
      </button>

      <button
        onClick={onDelete}
        disabled={selectedMenu === null}
        className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Delete Menu
      </button>
    </div>
  );
}
