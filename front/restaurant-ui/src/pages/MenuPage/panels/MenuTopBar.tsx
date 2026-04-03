import Button from "../../../components/Button";
import { MenuIcon, PlusIcon, SettingsIcon } from "../../../components/icons";

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
          <MenuIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--foreground)]">
            Active Menu Set
          </div>
          <div className="text-sm text-[var(--muted-foreground)]">
            Choose which menu you want to edit before adjusting sections or pricing.
          </div>
        </div>
      </div>

      <div className="rs-action-strip">
        <select
          className="rs-select min-w-[240px] flex-1"
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

        <Button onClick={onCreate}>
          <PlusIcon className="h-4 w-4" />
          New Menu
        </Button>
        <Button variant="secondary" onClick={onRename} disabled={selectedMenu === null}>
          <SettingsIcon className="h-4 w-4" />
          Rename
        </Button>
        <Button variant="danger" onClick={onDelete} disabled={selectedMenu === null}>
          Delete Menu
        </Button>
      </div>
    </div>
  );
}
