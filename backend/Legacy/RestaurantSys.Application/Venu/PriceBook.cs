using System;
using System.Collections.Generic;

namespace RestaurantSys.Application
{
    /// <summary>
    /// Provides prices for product names.
    /// </summary>
    public interface IPriceProvider
    {
        bool TryGetPrice(string productName, out decimal price);
    }

    /// <summary>
    /// Simple in-memory price provider (good for tests or seeding).
    /// </summary>
    public sealed class PriceBook : IPriceProvider
    {
        private readonly Dictionary<string, decimal> _map = new(StringComparer.OrdinalIgnoreCase);

        public void Set(string name, decimal price) => _map[name] = price;

        public bool TryGetPrice(string name, out decimal price) => _map.TryGetValue(name, out price);
    }
}
