using RestaurantSys.Domain;
using System;
using System.Collections.Generic;

namespace RestaurantSys.Application
{
    public static class StationsAndInventorySetup
    {
        /* ======================= Stations ======================= */

        /// <summary>Convenience container with the three main stations used in examples.</summary>
        public sealed record Stations(ServiceStation Bar1, ServiceStation Bar2, KitchenStation Kitchen);

        /// <summary>Create default stations (Bar1, Bar2, Kitchen).</summary>
        public static Stations CreateStations()
            => new(new ServiceStation("Bar1"), new ServiceStation("Bar2"), new KitchenStation("Kitchen"));

        /* =================== Tables identity only =================== */

        /// <summary>Immutable table identity you assign to stations (TableId + TableNumber).</summary>
        public sealed record TableInfo(Guid TableId, int TableNumber);

        /// <summary>
        /// Assigns tables to stations (identity-only). 
        /// NOTE: Implementation is left to your infra (e.g., attach to station/table repos).
        /// </summary>
        public static void AssignTablesToStations(Stations s, IEnumerable<TableInfo>? bar1 = null, IEnumerable<TableInfo>? bar2 = null)
        {
            var defaultBar1 = bar1 ?? new[]
            {
                new TableInfo(Guid.NewGuid(), 1),
                new TableInfo(Guid.NewGuid(), 2),
                new TableInfo(Guid.NewGuid(), 3),
            };

            var defaultBar2 = bar2 ?? new[]
            {
                new TableInfo(Guid.NewGuid(), 4),
                new TableInfo(Guid.NewGuid(), 5),
            };

            // Hook this to your persistence/UI layer:
            // for each table info -> create/attach a Table to s.Bar1 / s.Bar2 if you keep tables in memory on the station.
            // We keep this neutral to avoid assumptions about your Station API.
        }

        /* ============ Catalog (Ingredients + Products + Prices) ============ */

        /// <summary>
        /// A strongly-typed bundle so the rest of the app can refer to specific demo products.
        /// </summary>
        public sealed record CatalogAndProducts(
            Catalog Catalog,

            // Ingredients (families)
            Ingredient Soft_Lemonade, Ingredient Soft_OrangeJuice, Ingredient Soft_Cola,
            Ingredient Alcohol_Vodka, Ingredient Alcohol_Gin, Ingredient Alcohol_Campari, Ingredient Alcohol_Vermut,

            // Soft bottle products (examples used for inventory seed)
            Product Lemonade_2L, Product Orangejuice_2L, Product Cola_1_5L,

            // Alcohol bottle products (what you show on bottles menu)
            Product GG_1_5L, Product GG_1L, Product GG_700,
            Product Below42_1L,
            Product Bombay_1L, Product Bombay_700,
            Product Campari_1L,
            Product Martini_Rosso_700, Product Martini_Bianco_700, Product Martini_ExtraDry_700,

            // Cocktails
            Product Negroni
        );

        /// <summary>
        /// Build a catalog using the new model:
        /// - Ingredients are raw (no brand, no size).
        /// - Products are Bottle or Cocktail; pricing is on products.
        /// </summary>
        public static CatalogAndProducts BuildCatalog()
        {
            var cat = new Catalog();

            /* ---- Ingredients (ml-based) ---- */
            var lemonade = cat.AddIngredient("Lemonade", UnitType.Milliliter);
            var orange = cat.AddIngredient("Orangejuice", UnitType.Milliliter);
            var cola = cat.AddIngredient("Cola", UnitType.Milliliter);

            var vodka = cat.AddIngredient("Vodka", UnitType.Milliliter);
            var gin = cat.AddIngredient("Gin", UnitType.Milliliter);
            var campari = cat.AddIngredient("Campari", UnitType.Milliliter);
            var vermut = cat.AddIngredient("Vermut", UnitType.Milliliter);

            /* ---- Soft bottles (example SKUs for inventory) ---- */
            var lemonade2L = cat.AddBottle("Lemonade 2L", lemonade, 2000m, price: 0m);     // price optional here
            var orange2L = cat.AddBottle("Orangejuice 2L", orange, 2000m, price: 0m);
            var cola1_5L = cat.AddBottle("Cola 1.5L", cola, 1500m, price: 0m);

            /* ---- Alcohol bottles (what you show on bottles menu) ---- */
            var gg15 = cat.AddBottle("Grey Goose 1.5L", vodka, 1500m, price: 0m);
            var gg10 = cat.AddBottle("Grey Goose 1L", vodka, 1000m, price: 0m);
            var gg700 = cat.AddBottle("Grey Goose 700ml", vodka, 700m, price: 0m);
            var below42_1L = cat.AddBottle("Below42 1L", vodka, 1000m, price: 0m);

            var bombay_1L = cat.AddBottle("Bombay 1L", gin, 1000m, price: 0m);
            var bombay_700 = cat.AddBottle("Bombay 700ml", gin, 700m, price: 0m);
            var campari_1L = cat.AddBottle("Campari 1L", campari, 1000m, price: 0m);

            var martini_rosso_700 = cat.AddBottle("Martini Rosso 700ml", vermut, 700m, price: 0m);
            var martini_bianco_700 = cat.AddBottle("Martini Bianco 700ml", vermut, 700m, price: 0m);
            var martini_extra_700 = cat.AddBottle("Martini Extra Dry 700ml", vermut, 700m, price: 0m);

            /* ---- Cocktail products ---- */
            var negroni = cat.AddCocktail(
                "Negroni",
                new[] { (gin, 30m), (campari, 30m), (vermut, 30m) },
                price: 45m
            );

            return new CatalogAndProducts(
                cat,
                lemonade, orange, cola,
                vodka, gin, campari, vermut,
                lemonade2L, orange2L, cola1_5L,
                gg15, gg10, gg700,
                below42_1L,
                bombay_1L, bombay_700,
                campari_1L,
                martini_rosso_700, martini_bianco_700, martini_extra_700,
                negroni
            );
        }

        /// <summary>Make a menu tree using only Products (no variants).</summary>
        public static Menu BuildMenu(CatalogAndProducts c) => MenuBuilder.BuildMenu(
            c.Catalog,
            c.GG_1_5L, c.GG_1L, c.GG_700,
            c.Below42_1L,
            c.Bombay_1L, c.Bombay_700,
            c.Campari_1L,
            c.Martini_Rosso_700, c.Martini_Bianco_700, c.Martini_ExtraDry_700
        );

        /* ==================== Inventory Seeding ==================== */

        /// <summary>Seed Bar1 with some soft & alcohol bottles.</summary>
        public static void SeedInventory_Bar1(BottledInventoryService inv, Stations s, CatalogAndProducts c)
        {
            // SOFT (seed some backstock for pours)
            inv.Upsert(s.Bar1, c.Lemonade_2L, fullBottles: 5, thresholdBottles: 1);
            inv.Upsert(s.Bar1, c.Orangejuice_2L, fullBottles: 5, thresholdBottles: 1);
            inv.Upsert(s.Bar1, c.Cola_1_5L, fullBottles: 5, thresholdBottles: 1);

            // ALCOHOL
            inv.Upsert(s.Bar1, c.GG_1_5L, 10, 2);
            inv.Upsert(s.Bar1, c.GG_1L, 10, 2);
            inv.Upsert(s.Bar1, c.GG_700, 10, 2);
            inv.Upsert(s.Bar1, c.Below42_1L, 10, 2);
            inv.Upsert(s.Bar1, c.Bombay_1L, 10, 2);
            inv.Upsert(s.Bar1, c.Bombay_700, 10, 2);
            inv.Upsert(s.Bar1, c.Campari_1L, 10, 2);
            inv.Upsert(s.Bar1, c.Martini_Rosso_700, 10, 2);
            inv.Upsert(s.Bar1, c.Martini_Bianco_700, 10, 2);
            inv.Upsert(s.Bar1, c.Martini_ExtraDry_700, 10, 2);
        }

        /// <summary>Seed Bar2 with a smaller set.</summary>
        public static void SeedInventory_Bar2(BottledInventoryService inv, Stations s, CatalogAndProducts c)
        {
            // SOFT
            inv.Upsert(s.Bar2, c.Lemonade_2L, fullBottles: 5, thresholdBottles: 1);
            inv.Upsert(s.Bar2, c.Orangejuice_2L, fullBottles: 5, thresholdBottles: 1);
            inv.Upsert(s.Bar2, c.Cola_1_5L, fullBottles: 5, thresholdBottles: 1);

            // ALCOHOL
            inv.Upsert(s.Bar2, c.GG_1_5L, 5, 1);
            inv.Upsert(s.Bar2, c.GG_1L, 5, 1);
            inv.Upsert(s.Bar2, c.GG_700, 5, 1);
            inv.Upsert(s.Bar2, c.Below42_1L, 5, 1);
            inv.Upsert(s.Bar2, c.Bombay_1L, 5, 1);
            inv.Upsert(s.Bar2, c.Bombay_700, 5, 1);
            inv.Upsert(s.Bar2, c.Campari_1L, 5, 1);
            inv.Upsert(s.Bar2, c.Martini_Rosso_700, 5, 1);
            inv.Upsert(s.Bar2, c.Martini_Bianco_700, 5, 1);
            inv.Upsert(s.Bar2, c.Martini_ExtraDry_700, 5, 1);
        }
    }
}
