using System;
using System.Collections.Generic;
using System.Linq;
using RestaurantSys.Domain;

namespace RestaurantSys.Application
{
    /// <summary>
    /// Central registry for what the venue can sell.
    /// - Holds the list of raw Ingredients (Vodka, Lemonade, Salt, ...).
    /// - Holds the list of sellable Products (Bottle or Cocktail).
    /// - Holds simple pricing for Products (per product, not per unit).
    /// Notes:
    ///   * Inventory should deduct by Product.Components (ml per ingredient).
    ///   * Price can be read via TryGetPrice(product, out price).
    /// </summary>
    public sealed class Catalog
    {
        /* ===================== Storage ===================== */

        public List<Ingredient> Ingredients { get; } = new();
        // ^ All raw materials we can consume (e.g., Vodka (ml), Lemonade (ml), Salt (gram)).

        public List<Product> Products { get; } = new();
        // ^ All sellable items (Bottle or Cocktail). Bottle = 1 component; Cocktail = many components.

        public Dictionary<Guid, decimal> PriceByProductId { get; } = new();
        // ^ Price list: product.Id -> price (currency unit). One price per product.

        /* String indexes for quick lookup by name (case-insensitive) */
        private readonly Dictionary<string, Ingredient> _ingredientByName = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, Product> _productByName = new(StringComparer.OrdinalIgnoreCase);

        /* ===================== Ingredient API ===================== */

        /// <summary>Add a new raw ingredient (no brand, no size; size lives on products).</summary>
        public Ingredient AddIngredient(string name, UnitType unit)
        {
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name required.", nameof(name));
            if (_ingredientByName.ContainsKey(name)) throw new InvalidOperationException($"Ingredient '{name}' already exists.");

            var ing = new Ingredient(name, unit);
            Ingredients.Add(ing);
            _ingredientByName[name] = ing;
            return ing;
        }

        /// <summary>Find an ingredient by name (case-insensitive). Returns null if missing.</summary>
        public Ingredient? FindIngredient(string name)
            => _ingredientByName.TryGetValue(name, out var ing) ? ing : null;

        /* ===================== Product API ===================== */

        /// <summary>
        /// Add a Bottle product: exactly one ingredient with a size in ml.
        /// Example: AddBottle("Vodka 1L", vodka, 1000, 120m)
        /// </summary>
        public Product AddBottle(string productName, Ingredient ingredient, decimal sizeMl, decimal? price = null)
        {
            if (ingredient is null) throw new ArgumentNullException(nameof(ingredient));
            if (ingredient.BaseUnit != UnitType.Milliliter)
                throw new InvalidOperationException("Bottle must reference a liquid ingredient (ml).");

            var p = new Product(
                name: productName,
                type: ProductType.Bottle,
                components: new[] { new ProductComponent(ingredient, sizeMl) });

            AddProductInternal(p, price);
            return p;
        }

        /// <summary>
        /// Add a Cocktail product: multiple ingredients with per-ingredient ml amounts.
        /// Example:
        ///   AddCocktail("Negroni", new[] { (gin,30m), (campari,30m), (vermut,30m) }, 45m)
        /// </summary>
        public Product AddCocktail(string productName, IEnumerable<(Ingredient ingredient, decimal ml)> components, decimal? price = null)
        {
            if (components is null) throw new ArgumentNullException(nameof(components));

            var list = new List<ProductComponent>();
            foreach (var (ing, ml) in components)
                list.Add(new ProductComponent(ing, ml)); // validates ml and unit

            var p = new Product(productName, ProductType.Cocktail, list);
            AddProductInternal(p, price);
            return p;
        }

        /// <summary>Find a product by name (case-insensitive). Returns null if missing.</summary>
        public Product? FindProduct(string name)
            => _productByName.TryGetValue(name, out var p) ? p : null;

        /* ===================== Pricing API ===================== */

        /// <summary>Assign/override the price for a product.</summary>
        public void SetPrice(Product product, decimal price)
        {
            if (product is null) throw new ArgumentNullException(nameof(product));
            if (price < 0) throw new ArgumentOutOfRangeException(nameof(price), "Price cannot be negative.");
            PriceByProductId[product.Id] = price;
        }

        /// <summary>Try to get the price of a product; returns false if price not set.</summary>
        public bool TryGetPrice(Product product, out decimal price)
        {
            if (product is null) throw new ArgumentNullException(nameof(product));
            return PriceByProductId.TryGetValue(product.Id, out price);
        }

        /// <summary>Convenience: get price by product name; returns null if product or price is missing.</summary>
        public decimal? GetPrice(string productName)
            => _productByName.TryGetValue(productName, out var p) && PriceByProductId.TryGetValue(p.Id, out var price)
                ? price
                : (decimal?)null;

        /* ===================== Maintenance ===================== */

        /// <summary>Remove everything from the catalog (ingredients, products, prices, indexes).</summary>
        public void Reset()
        {
            Ingredients.Clear();
            Products.Clear();
            PriceByProductId.Clear();
            _ingredientByName.Clear();
            _productByName.Clear();
        }

        /* ===================== Internals ===================== */

        private void AddProductInternal(Product p, decimal? price)
        {
            if (string.IsNullOrWhiteSpace(p.Name))
                throw new ArgumentException("Product name required.", nameof(p));

            if (_productByName.ContainsKey(p.Name))
                throw new InvalidOperationException($"Product '{p.Name}' already exists.");

            Products.Add(p);
            _productByName[p.Name] = p;

            if (price is not null)
                PriceByProductId[p.Id] = price.Value;
        }
    }
}
