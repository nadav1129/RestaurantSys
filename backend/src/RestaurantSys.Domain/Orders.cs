using System;
using System.Collections.Generic;

namespace RestaurantSys.Domain
{
    public enum OrderStatus { New, InPreparation, Ready, Served, Cancelled }

    /// <summary>
    /// What kind of thing this line orders.
    /// - Product: a concrete Product (Bottle or Cocktail) by Id.
    /// - GenericPour: a family pour (resolved by ingredient group tag + ml).
    /// </summary>
    public enum OrderLineKind { Product, GenericPour }

    /// <summary>
    /// Canonical order line specification, independent of UI/Menu.
    /// </summary>
    public sealed class OrderLineSpec
    {
        public OrderLineKind Kind { get; }                 /* Product or GenericPour */
        public Guid? ProductId { get; }                    /* When Kind == Product */
        public string? GroupTag { get; }                   /* When Kind == GenericPour (e.g., "Alcohol", "Soft") */
        public decimal? Ml { get; }                        /* When Kind == GenericPour */

        public IReadOnlyDictionary<string, string> Options => _options;
        private readonly Dictionary<string, string> _options;  /* e.g., { "softChoice":"Lemonade", "leadSwap":"Gin->Vodka" } */

        private OrderLineSpec(OrderLineKind kind, Guid? productId, string? groupTag, decimal? ml,
                              Dictionary<string, string>? options)
        {
            Kind = kind;
            ProductId = productId;
            GroupTag = groupTag;
            Ml = ml;
            _options = options is null ? new() : new(options);
        }

        /* Factory: product-backed line */
        public static OrderLineSpec ForProduct(Guid productId, Dictionary<string, string>? options = null)
            => new(OrderLineKind.Product, productId, null, null, options);

        /* Factory: generic pour (family + ml) */
        public static OrderLineSpec ForGenericPour(string groupTag, decimal ml, Dictionary<string, string>? options = null)
            => new(OrderLineKind.GenericPour, null, groupTag, ml, options);
    }

    /// <summary>
    /// Concrete item on an order: a spec + quantity.
    /// </summary>
    public sealed class OrderItem
    {
        public OrderLineSpec Spec { get; }    /* Canonical, menu-agnostic line spec */
        public int Quantity { get; }

        public OrderItem(OrderLineSpec spec, int quantity)
        {
            if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity));
            Spec = spec ?? throw new ArgumentNullException(nameof(spec));
            Quantity = quantity;
        }
    }

    /// <summary>
    /// Order aggregates order items and state. No dependency on menu/UI.
    /// </summary>
    public sealed class Order
    {
        public Guid Id { get; } = Guid.NewGuid();
        public string? TableName { get; }
        public DateTime CreatedAt { get; } = DateTime.UtcNow;

        private readonly List<OrderItem> _items = new();
        public IReadOnlyList<OrderItem> Items => _items;

        public OrderStatus Status { get; private set; } = OrderStatus.New;

        public Order(string? tableName = null) => TableName = tableName;

        public Order AddItem(OrderLineSpec spec, int qty)
        {
            _items.Add(new OrderItem(spec, qty));
            return this;
        }

        public void MarkInPreparation() => Status = OrderStatus.InPreparation;
        public void MarkReady() => Status = OrderStatus.Ready;
        public void MarkServed() => Status = OrderStatus.Served;
        public void Cancel() => Status = OrderStatus.Cancelled;
    }
}
