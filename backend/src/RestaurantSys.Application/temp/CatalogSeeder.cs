using RestaurantSys.Application;
using RestaurantSys.Domain;

public static class CatalogSeeder
{
    public static (Catalog catalog,
                   Product gg1_5L, Product gg1L, Product gg700,
                   Product below42_1L,
                   Product bombay_1L, Product bombay_700,
                   Product campari_1L,
                   Product martini_rosso_700, Product martini_bianco_700, Product martini_extra_700)
        BuildCatalog()
    {
        var cat = new Catalog();

        /* 1. Create base ingredients */
        var vodka = cat.AddIngredient("Vodka", UnitType.Milliliter);
        var gin = cat.AddIngredient("Gin", UnitType.Milliliter);
        var campari = cat.AddIngredient("Campari", UnitType.Milliliter);
        var vermutRosso = cat.AddIngredient("Vermut Rosso", UnitType.Milliliter);
        var soft = cat.AddIngredient("Soft", UnitType.Milliliter); /* placeholder group for soft drinks */

        /* 2. Create bottle products */
        var gg1_5L = cat.AddBottle("Grey Goose 1.5L", vodka, 1500m, price: 600m);
        var gg1L = cat.AddBottle("Grey Goose 1L", vodka, 1000m, price: 450m);
        var gg700 = cat.AddBottle("Grey Goose 700ml", vodka, 700m, price: 350m);

        var below42_1L = cat.AddBottle("Below42 1L", vodka, 1000m, price: 300m);

        var bombay_1L = cat.AddBottle("Bombay 1L", gin, 1000m, price: 400m);
        var bombay_700 = cat.AddBottle("Bombay 700ml", gin, 700m, price: 320m);

        var campari_1L = cat.AddBottle("Campari 1L", campari, 1000m, price: 280m);

        var martini_rosso_700 = cat.AddBottle("Martini Rosso 700", vermutRosso, 700m, price: 200m);
        var martini_bianco_700 = cat.AddBottle("Martini Bianco 700", vermutRosso, 700m, price: 200m);
        var martini_extra_700 = cat.AddBottle("Martini Extra Dry 700", vermutRosso, 700m, price: 200m);

        /* 3. Add a cocktail product like Negroni */
        var negroni = cat.AddCocktail(
            "Negroni",
            new (Ingredient ingredient, decimal ml)[] {
                (gin, 30m),
                (campari, 30m),
                (vermutRosso, 30m)
            },
            price: 45m
        );

        /* we already passed price: 45m, so Catalog.SetPrice was done in AddProductInternal */

        return (cat,
                gg1_5L, gg1L, gg700,
                below42_1L,
                bombay_1L, bombay_700,
                campari_1L,
                martini_rosso_700, martini_bianco_700, martini_extra_700);
    }
}
