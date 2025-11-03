using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace RestaurantSys.Api
{
    /* ============ MENU TYPES ============ */
    public sealed class MenuDto
    {
        public int MenuNum { get; set; }
        public string Name { get; set; } = "";
    }

    public sealed class CreateMenuRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string? Name { get; set; }
    }




    /* ============ MENU TREE ============ */
    public sealed class MenuNodeDto
    {
        public int MenuNum { get; set; }
        public Guid Id { get; set; }
        public Guid? ParentId { get; set; }
        public string Name { get; set; } = "";
        public bool IsLeaf { get; set; }

        // NEW: depth from the implicit root (root=0, top-level=1, etc.)
        public int Layer { get; set; }

        // NEW: order among siblings (computed per ParentId)
        public int SortOrder { get; set; }

        // Optional: if your leaves have prices
        public int? PriceCents { get; set; }

        public List<MenuNodeDto> Children { get; set; } = new();
    }

    public sealed class CreateMenuNodeRequest
    {
        [JsonPropertyName("MenuNum")]
        public int MenuNum { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("isLeaf")]
        public bool IsLeaf { get; set; }

        [JsonPropertyName("priceCents")]
        public int? PriceCents { get; set; }

        [JsonPropertyName("parentId")]
        public Guid? ParentId { get; set; }   
    }



    /* ============ PRODUCTS LIST ============ */
    public sealed class ProductListItemDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = "";
        public string Type { get; set; } = ""; /* "Bottle" / "Cocktail" / etc */
        public decimal? Price { get; set; }     /* from Catalog.PriceByProductId */
    }



    /* ============ NEW PRODUCT REQUEST (from AddProductModal) ============ */
    public sealed class CreateProductRequest
    {
        public string Name { get; set; } = "";
        public Guid MenuNodeId { get; set; }
        public string Type { get; set; } = ""; /* ui will send "Bottle" / "Cocktail" for now */
        public decimal ? Price { get; set; }
        public List<CreateProductComponentRequest> Components { get; set; } = new();
    }

    public sealed class CreateProductComponentRequest
    {
        public Guid IngredientId { get; set; }
        public decimal AmountMl { get; set; }         /* parse from UI "amount" */
        public bool IsLeading { get; set; }
        public bool IsChangeable { get; set; }
    }



    /* ============ INGREDIENTS (for dropdowns) ============ */
    public sealed class IngredientDto
    {
        public Guid IngredientId { get; set; }
        public string Name { get; set; } = "";
    }



    /* ============ SPEED RAIL ============ */
    public sealed class SpeedMapRowDto
    {
        public Guid IngredientId { get; set; }
        public string IngredientName { get; set; } = "";
        public Guid? BottleProductId { get; set; }
        public string? BottleProductName { get; set; }
    }

    public sealed class UpdateSpeedMapRequestRow
    {
        public Guid IngredientId { get; set; }
        public Guid? BottleProductId { get; set; }
    }



    /* ============ PRICES TAB ============ */
    public sealed class PriceRowDto
    {
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = "";
        public decimal? Price { get; set; }
    }

    public sealed class UpdatePriceRequestRow
    {
        public Guid ProductId { get; set; }
        public decimal Price { get; set; }
    }
}
