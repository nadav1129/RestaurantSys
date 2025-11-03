using System;
using System.Collections.Generic;

namespace RestaurantSys.Domain
{
    /* ===== Units & Product types ===== */

    public enum UnitType { Milliliter, Gram, Unit } /* Base unit for an ingredient (ml for liquids, etc.) */
    public enum ProductType { Bottle, Pour, Cocktail }     /* What kind of product this is */

    /* ===== Ingredients ===== */

    /// <summary>
    /// A raw material like Vodka, Lemonade, Salt. No brands, no package sizes here.
    /// Sizes (1L, 2L, …) live on the Product side (for bottles).
    /// </summary>
    public sealed class Ingredient
    {
        public Guid Id { get; } = Guid.NewGuid();          /* Stable identity */
        public string Name { get; }                        /* Display name: "Vodka", "Lemonade", "Salt" */
        public UnitType BaseUnit { get; }                  /* The unit this ingredient is measured in (ml/gram/unit) */

        public Ingredient(string name, UnitType baseUnit)
        {
            Name = name.Trim();
            BaseUnit = baseUnit;
        }

        public override string ToString() => Name;
    }

    /* ===== Product composition ===== */

    /// <summary>
    /// One component of a product (e.g., for cocktails).
    /// For a Bottle-type product, you will typically have EXACTLY ONE component:
    ///   Ingredient = Vodka, AmountMl = 1000 (for 1L).
    /// </summary>
    public sealed class ProductComponent
    {
        public Ingredient Ingredient { get; }              /* Which ingredient is used */
        public decimal AmountMl { get; }                   /* How many milliliters this component contributes */

        public ProductComponent(Ingredient ingredient, decimal amountMl)
        {
            if (ingredient.BaseUnit != UnitType.Milliliter)
                throw new InvalidOperationException("This model uses ml components; non-liquid ingredients would need a grams/units path.");
            if (amountMl <= 0) throw new ArgumentOutOfRangeException(nameof(amountMl));
            Ingredient = ingredient;
            AmountMl = amountMl;
        }
    }

    /* ===== Product (Bottle or Cocktail) ===== */

    /// <summary>
    /// A sellable product.
    /// - Bottle: one ingredient + size in ml (represented by a single component).
    /// - Cocktail: multiple ingredients, each with ml amount.
    /// Pricing is external (PriceBook), inventory will deduct by components.
    /// </summary>
    public sealed class Product
    {
        public Guid Id { get; } = Guid.NewGuid();          /* Stable identity for pricing/ordering */
        public string Name { get; }                        /* Display name: "Vodka 1L", "Negroni" */
        public ProductType Type { get; }                   /* Bottle or Cocktail */
        public List<ProductComponent> Components { get; }  /* Component list; 1 for bottle, many for cocktail */

        public Product(string name, ProductType type, IEnumerable<ProductComponent> components)
        {
            Name = name.Trim();
            Type = type;
            Components = new List<ProductComponent>(components ?? Array.Empty<ProductComponent>());

            if (Type == ProductType.Bottle && Components.Count != 1)
                throw new InvalidOperationException("Bottle must have exactly one component (the ingredient + ml size).");
            if (Components.Count == 0)
                throw new InvalidOperationException("Product must contain at least one component.");
        }

        /* Convenience helpers */

        public bool IsBottle => Type == ProductType.Bottle;                 /* Quick check */
        public ProductComponent BottleComponent =>                          /* Safe access for bottle products */
            IsBottle ? Components[0] : throw new InvalidOperationException("Not a bottle product.");

        public decimal TotalMl                                              /* Sum of all ml in this product (useful for cocktails) */
        {
            get
            {
                decimal sum = 0;
                foreach (var c in Components) sum += c.AmountMl;
                return sum;
            }
        }
    }
}
