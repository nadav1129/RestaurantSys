using RestaurantSys.Application;
using RestaurantSys.Domain;

public static class MenuBuilder
{
    // Build from Catalog + specific Products you want highlighted.
    // Notes:
    // - Dynamic tree: any depth of sections; only LEAVES are selectable.
    // - Product-backed entries use Product.Id; prices are read from Catalog.
    // - Generic pours (by group tag) enable "shot + soft" combo.
    // - Cocktails can declare a leading ingredient group for substitution.
    public static Menu BuildMenu(
        Catalog cat,
        Product gg1_5L, Product gg1L, Product gg700,
        Product below42_1L,
        Product bombay_1L, Product bombay_700,
        Product campari_1L,
        Product martini_rosso_700, Product martini_bianco_700, Product martini_extra_700)
    {
        var menu = new Menu();

        /* ===================== Bottles (Alcohol) ===================== */
        // Leaf of product-backed bottle items; price comes from Catalog (single source of truth).
        var alcoholBottlesLeaf = MenuFactory.Leaf("Alcohol Bottles", "products",
            MenuFactory.Product("Grey Goose 1.5L", gg1_5L, cat.GetPrice(gg1_5L.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Grey Goose 1L", gg1L, cat.GetPrice(gg1L.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Grey Goose 700ml", gg700, cat.GetPrice(gg700.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Below42 1L", below42_1L, cat.GetPrice(below42_1L.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Bombay 1L", bombay_1L, cat.GetPrice(bombay_1L.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Bombay 700ml", bombay_700, cat.GetPrice(bombay_700.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Campari 1L", campari_1L, cat.GetPrice(campari_1L.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Martini Rosso 700", martini_rosso_700, cat.GetPrice(martini_rosso_700.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Martini Bianco 700", martini_bianco_700, cat.GetPrice(martini_bianco_700.Name) ?? 0m, MenuCategory.Bottle),
            MenuFactory.Product("Martini Extra Dry 700", martini_extra_700, cat.GetPrice(martini_extra_700.Name) ?? 0m, MenuCategory.Bottle)
        );

        // Example of deeper nesting: “Bottles -> Alcohol -> Premium/Regular”
        var alcoholPremiumSection = MenuFactory.Section("Premium",
            MenuFactory.Leaf("Grey Goose", "products",
                MenuFactory.Product("Grey Goose 1L", gg1L, cat.GetPrice(gg1L.Name) ?? 0m, MenuCategory.Bottle),
                MenuFactory.Product("Grey Goose 700ml", gg700, cat.GetPrice(gg700.Name) ?? 0m, MenuCategory.Bottle)
            )
        );

        var bottlesAlcoholSection = MenuFactory.Section("Bottles - Alcohol",
            alcoholPremiumSection,
            alcoholBottlesLeaf
        );

        /* ===================== Soft Drinks (Generic pours) ===================== */
        // Generic family pours (resolved by group tag at order time).
        // Group tags like "Soft" / "Alcohol" should be your manager-configurable ingredient tags.
        var softGlassLeaf = MenuFactory.Leaf("Basic Soft Drinks - Glass", "pours",
            MenuFactory.Pour("Soft (any) 250ml", "Soft", 250m, price: 12m, MenuCategory.Other)
        );

        var bottlesSoftSection = MenuFactory.Section("Bottles - Soft",
            softGlassLeaf
        );

        /* ===================== Shots & Chasers (Special mechanic #1) ===================== */
        // Shot entries can declare a Soft combo (add-on). Pricing mode can be Additive or Fixed.
        var shotsLeaf = MenuFactory.Leaf("Shots (60ml)", "pours",
            MenuFactory.Pour(
                label: "Alcohol (any) 60ml",
                groupTag: "Alcohol",
                ml: 60m,
                price: 28m,
                cat: MenuCategory.Shot,
                combo: new ShotSoftCombo
                {
                    Enabled = true,
                    SoftGroupTag = "Soft",     // manager tag for soft options
                    SoftMl = 250m,             // add-on size
                    PriceMode = ShotSoftCombo.ComboPriceMode.Additive,
                    FixedComboPrice = null     // or set a value + switch to Fixed if you want
                })
        );

        var chasersLeaf = MenuFactory.Leaf("Chasers (30ml)", "pours",
            MenuFactory.Pour("Alcohol (any) 30ml", "Alcohol", 30m, price: 18m, MenuCategory.Chaser)
        );

        var shotsAndChasersSection = MenuFactory.Section("Shots & Chasers",
            shotsLeaf,
            chasersLeaf
        );

        /* ===================== Cocktails (Special mechanic #2) ===================== */
        // Cocktail as a product-backed item (recipe lives inside Product.Components).
        // Leading-ingredient substitution: allow swapping the “Gin” component with any ingredient tagged "Gin".
        var negroni = cat.FindProduct("Negroni");
        MenuNode cocktailsSection;

        if (negroni is not null)
        {
            var negroniLeaf = MenuFactory.Leaf("Negroni", "products",
                MenuFactory.Product(
                    label: "Negroni",
                    product: negroni,
                    price: cat.GetPrice("Negroni") ?? 0m,
                    cat: MenuCategory.Cocktail,
                    leading: new CocktailLeadingSubstitution
                    {
                        Enabled = true,
                        LeadingGroupTag = "Gin",  // manager tag for ingredients considered "Gin"
                        LeadingMl = 30m,          // ml attributed to the leading component for inventory adjustment
                        PriceMode = CocktailLeadingSubstitution.SubstitutionPriceMode.NoChange,
                        PriceDelta = null,
                        FixedPrice = null
                    })
            );

            cocktailsSection = MenuFactory.Section("Cocktails", negroniLeaf);
        }
        else
        {
            // If Negroni doesn't exist in the catalog, keep the section empty (UI can hide empty leaves).
            cocktailsSection = MenuFactory.Section("Cocktails");
        }

        /* ===================== Add roots to the dynamic menu tree ===================== */
        // You can nest arbitrarily: sections can have sections or leaves in any order and depth.
        menu
            .AddRoot(bottlesSoftSection)
            .AddRoot(bottlesAlcoholSection)
            .AddRoot(shotsAndChasersSection)
            .AddRoot(cocktailsSection);

        return menu;
    }
}
