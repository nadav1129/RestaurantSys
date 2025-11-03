using System;
using System.Collections.Generic;
using System.Linq;
using RestaurantSys.Domain;

namespace RestaurantSys.Application
{
    /* ============================================================
     * MENU DOMAIN (dynamic, arbitrarily nested, UI-driven)
     * ------------------------------------------------------------
     * - Tree of nodes: MenuNode (Section) -> children (sections/leaves)
     * - Only "Leaf" nodes are selectable; they carry a Tag to signal
     *   the UI that this is a terminal selection point.
     * - Leaves contain one or more MenuEntry items:
     *     • Product-backed entries (reference Product.Id)
     *     • Generic "Pour by group" entries (e.g., Alcohol 30ml)
     * - Two special mechanics:
     *     1) Shot + Soft Combo (opt-in per entry)
     *     2) Cocktail leading-ingredient substitution (opt-in per entry)
     * ============================================================*/

    /// <summary>
    /// Top-level Menu holder: a forest of root sections (so you can have multiple top categories).
    /// </summary>
    public sealed class Menu
    {
        private readonly List<MenuNode> _roots = new();          /* Root nodes (top-level sections). */
        public IReadOnlyList<MenuNode> Roots => _roots;

        public Menu AddRoot(MenuNode node) { _roots.Add(node); return this; }

        /// <summary>
        /// Enumerate all selectable leaves (depth-first).
        /// </summary>
        public IEnumerable<MenuLeaf> Leaves()
        {
            foreach (var r in _roots) foreach (var leaf in r.EnumerateLeaves()) yield return leaf;
        }
    }

    /// <summary>
    /// A node in the menu tree. It is either a Section (branch) or a Leaf (selectable endpoint).
    /// </summary>
    public abstract class MenuNode
    {
        public string Name { get; }                              /* Display name for the node (e.g., "Bottles", "Shots"). */
        protected MenuNode(string name) => Name = name.Trim();

        public abstract IEnumerable<MenuLeaf> EnumerateLeaves();
    }

    /// <summary>
    /// Section node: can contain other sections and/or leaves in any order/depth.
    /// </summary>
    public sealed class MenuSection : MenuNode
    {
        private readonly List<MenuNode> _children = new();       /* Arbitrary mix of sections + leaves. */
        public IReadOnlyList<MenuNode> Children => _children;

        public MenuSection(string name) : base(name) { }

        public MenuSection Add(MenuNode child) { _children.Add(child); return this; }

        public override IEnumerable<MenuLeaf> EnumerateLeaves()
        {
            foreach (var c in _children)
                foreach (var l in c.EnumerateLeaves())
                    yield return l;
        }
    }

    /// <summary>
    /// Leaf node: a selectable endpoint containing one or more entries (buttons).
    /// The UI should enable selection only on leaves (not sections).
    /// </summary>
    public sealed class MenuLeaf : MenuNode
    {
        public string LeafTag { get; }                           /* Tag that tells UI "this is selectable" (e.g., "products", "pours"). */
        private readonly List<MenuEntry> _entries = new();       /* The actual action items/buttons at this leaf. */
        public IReadOnlyList<MenuEntry> Entries => _entries;

        public MenuLeaf(string name, string leafTag) : base(name)
        {
            LeafTag = leafTag.Trim();
        }

        public MenuLeaf AddEntry(MenuEntry e) { _entries.Add(e); return this; }

        public override IEnumerable<MenuLeaf> EnumerateLeaves()
        {
            yield return this;
        }
    }

    /* ========================= Entries ========================= */

    public enum MenuCategory
    {
        Bottle,     /* Whole bottle sale (product-backed). */
        Shot,       /* ~30–60ml quick pour; supports Soft combo (special mechanic #1). */
        Chaser,     /* 30ml; could share the same mechanic if desired. */
        Cocktail,   /* Multi-ingredient product; supports leading substitution (special mechanic #2). */
        Food,
        WineBottle,
        WineGlass,
        Other
    }

    /// <summary>
    /// A selectable item at a leaf. Either Product-backed or a Generic pour-by-group.
    /// </summary>
    public abstract class MenuEntry
    {
        public string DisplayName { get; }                       /* What the button shows. */
        public MenuCategory Category { get; }                    /* Category drives behaviors (e.g., Shot combo). */
        public decimal Price { get; }                            /* Base price shown/charged (pre-combo). */

        protected MenuEntry(string displayName, MenuCategory category, decimal price)
        {
            DisplayName = displayName.Trim();
            Category = category;
            Price = price;
        }
    }

    /// <summary>
    /// Entry that references an existing Product (Bottle or Cocktail) by Id.
    /// </summary>
    public sealed class ProductEntry : MenuEntry
    {
        public Guid ProductId { get; }                           /* Link to Catalog.Product.Id (source of truth). */
        public ProductEntry(string displayName, MenuCategory category, decimal price, Guid productId)
            : base(displayName, category, price)
        {
            ProductId = productId;
        }

        /* ---- Special mechanic #2 (cocktail leading substitution) ---- */
        public CocktailLeadingSubstitution? LeadingSubstitution { get; init; }  /* Null = disabled. */
    }

    /// <summary>
    /// Entry that pours by group/family (e.g., "Alcohol 30ml", "Soft 250ml").
    /// GroupTag is a free-form label the manager uses to tag ingredients (e.g., "Alcohol", "Soft", "Gin").
    /// </summary>
    public sealed class GenericPourEntry : MenuEntry
    {
        public string GroupTag { get; }                           /* Ingredient group (manager-defined tag), e.g. "Alcohol", "Soft". */
        public decimal MlAmount { get; }                          /* How many ml to pour. */

        public GenericPourEntry(string displayName, MenuCategory category, decimal price, string groupTag, decimal mlAmount)
            : base(displayName, category, price)
        {
            GroupTag = groupTag.Trim();
            MlAmount = mlAmount;
        }

        /* ---- Special mechanic #1 (shots + soft pairing) ---- */
        public ShotSoftCombo? SoftCombo { get; init; }            /* Null = disabled. */
    }

    /* ===================== Special Mechanics ===================== */

    /// <summary>
    /// Mechanic #1: When ordering a shot, allow picking a Soft drink add-on.
    /// The final price = Shot price + selected soft option price (or an override strategy).
    /// </summary>
    public sealed class ShotSoftCombo
    {
        public bool Enabled { get; init; }                        /* Quick switch. */
        public string SoftGroupTag { get; init; } = "Soft";       /* Which ingredient group counts as "Soft" options. */
        public decimal SoftMl { get; init; } = 250m;              /* Default ml size for the add-on. */
        public ComboPriceMode PriceMode { get; init; } = ComboPriceMode.Additive;
        public decimal? FixedComboPrice { get; init; }            /* Used only if PriceMode == Fixed. */

        public enum ComboPriceMode { Additive, Fixed }
    }

    /// <summary>
    /// Mechanic #2: For cocktails, mark a "leading" ingredient by group tag (e.g., "Gin"),
    /// and allow the bartender to swap it with another ingredient that has the same tag.
    /// </summary>
    public sealed class CocktailLeadingSubstitution
    {
        public bool Enabled { get; init; }                        /* Quick switch. */
        public string LeadingGroupTag { get; init; } = "";        /* e.g., "Gin" — matches ingredients tagged as Gin. */
        public decimal LeadingMl { get; init; }                   /* How many ml belong to the leading component (used to adjust inventory). */
        public SubstitutionPriceMode PriceMode { get; init; } = SubstitutionPriceMode.NoChange;
        public decimal? PriceDelta { get; init; }                 /* When PriceMode == Delta, add/subtract to base price. */
        public decimal? FixedPrice { get; init; }                 /* When PriceMode == Fixed, override total price. */

        public enum SubstitutionPriceMode { NoChange, Delta, Fixed }
    }

    /* ===================== Helper factory API ===================== */

    public static class MenuFactory
    {
        /* Section/Leaf creation */
        public static MenuSection Section(string name, params MenuNode[] children)
            => new MenuSection(name).AddMany(children);

        public static MenuLeaf Leaf(string name, string tag, params MenuEntry[] entries)
            => new MenuLeaf(name, tag).AddMany(entries);

        /* Entries */

        public static ProductEntry Product(string label, Product product, decimal price, MenuCategory cat,
                                           CocktailLeadingSubstitution? leading = null)
            => new ProductEntry(label, cat, price, product.Id) { LeadingSubstitution = leading };

        public static GenericPourEntry Pour(string label, string groupTag, decimal ml, decimal price, MenuCategory cat,
                                            ShotSoftCombo? combo = null)
            => new GenericPourEntry(label, cat, price, groupTag, ml) { SoftCombo = combo };

        /* Small fluent helpers */

        private static MenuSection AddMany(this MenuSection s, IEnumerable<MenuNode> nodes)
        {
            foreach (var n in nodes) s.Add(n);
            return s;
        }

        private static MenuLeaf AddMany(this MenuLeaf l, IEnumerable<MenuEntry> entries)
        {
            foreach (var e in entries) l.AddEntry(e);
            return l;
        }
    }

    /* ===================== Usage sketch (for wiring) =====================
     * var menu = new Menu()
     *   .AddRoot(MenuFactory.Section("Bottles",
     *       MenuFactory.Leaf("Vodka", "products",
     *           MenuFactory.Product("Vodka 1L", vodka1L, cat.GetPrice("Vodka 1L") ?? 0m, MenuCategory.Bottle)),
     *       MenuFactory.Leaf("Gin", "products",
     *           MenuFactory.Product("Bombay 700ml", bombay700, cat.GetPrice("Bombay 700ml") ?? 0m, MenuCategory.Bottle))
     *   ))
     *   .AddRoot(MenuFactory.Section("Shots & Chasers",
     *       MenuFactory.Leaf("Shots", "pours",
     *           MenuFactory.Pour("Alcohol 60ml", "Alcohol", 60m, 28m, MenuCategory.Shot,
     *               new ShotSoftCombo { Enabled = true, SoftGroupTag = "Soft", SoftMl = 250m, PriceMode = ShotSoftCombo.ComboPriceMode.Additive })),
     *       MenuFactory.Leaf("Chasers", "pours",
     *           MenuFactory.Pour("Alcohol 30ml", "Alcohol", 30m, 18m, MenuCategory.Chaser))
     *   ))
     *   .AddRoot(MenuFactory.Section("Cocktails",
     *       MenuFactory.Leaf("Negroni", "products",
     *           MenuFactory.Product("Negroni", negroni, cat.GetPrice("Negroni") ?? 0m, MenuCategory.Cocktail,
     *               new CocktailLeadingSubstitution {
     *                   Enabled = true, LeadingGroupTag = "Gin", LeadingMl = 30m,
     *                   PriceMode = CocktailLeadingSubstitution.SubstitutionPriceMode.NoChange
     *               }))
     *   ));
     *
     * UI: render Sections recursively; only Leaves are selectable (LeafTag tells you what to show).
     * ====================================================================*/
}
