using System;
using System.Collections.Generic;
using RestaurantSys.Domain;

namespace RestaurantSys.Application
{
    /// <summary>
    /// Executes orders for a table: tries to consume inventory (if wired) and writes priced lines to the table.
    /// Product lookup/pricing and stock deduction are abstracted behind IPriceProvider and IInventoryConsumer.
    /// </summary>
    public sealed class OrderExecutor
    {
        private readonly IPriceProvider _prices;
        private readonly IInventoryConsumer _inventory;
        private readonly Notifications _notifications;
        private readonly TableService _tables;

        public OrderExecutor(
            IPriceProvider prices,
            IInventoryConsumer inventory,
            Notifications notifications,
            TableService tables)
        {
            _prices = prices ?? throw new ArgumentNullException(nameof(prices));
            _inventory = inventory ?? throw new ArgumentNullException(nameof(inventory));
            _notifications = notifications ?? throw new ArgumentNullException(nameof(notifications));
            _tables = tables ?? throw new ArgumentNullException(nameof(tables));
        }

        /// <summary>
        /// Execute a batch of (productName, quantity) against a table.
        /// Uses BarStation for inventory scoping (bar1 vs bar2).
        /// </summary>
        public void ExecuteForTable(ServiceStation station, Table table, IEnumerable<(string productName, int quantity)> items)
        {
            if (station is null) throw new ArgumentNullException(nameof(station));
            if (table is null) throw new ArgumentNullException(nameof(table));
            if (items is null) throw new ArgumentNullException(nameof(items));

            decimal subtotal = 0m;

            foreach (var (productName, quantity) in items)
            {
                if (quantity <= 0)
                {
                    _notifications.OrderFailed(table.TableNumber, $"Invalid quantity for '{productName}': {quantity}.");
                    throw new InvalidOperationException($"Quantity must be positive for '{productName}'.");
                }

                if (!_prices.TryGetPrice(productName, out var unitPrice))
                {
                    _notifications.OrderFailed(table.TableNumber, $"Unknown product '{productName}'.");
                    throw new InvalidOperationException($"Unknown product: {productName}");
                }

                // Try to consume inventory (no-op if your implementation returns true without stock mgmt).
                if (!_inventory.TryConsume(station, productName, quantity, _notifications))
                {
                    _notifications.OrderFailed(table.TableNumber, $"Not enough stock for '{productName}' (x{quantity}).");
                    throw new InvalidOperationException($"Insufficient stock: {productName} x{quantity}");
                }

                // Record line to table and update totals
                _tables.AddLine(table, productName, quantity, unitPrice);
                subtotal += unitPrice * quantity;
            }

            // Table totals already recalculated by AddLine → but call success with the current bill
            _notifications.OrderSucceeded(table.TableNumber, subtotal, table.AmountToPay);
        }

        public void ExecuteSingle(ServiceStation station, Table table, string productName, int quantity)
            => ExecuteForTable(station, table, new[] { (productName, quantity) });
    }

    /// <summary>Consumes inventory for a product; return false to indicate stock failure.</summary>
    public interface IInventoryConsumer
    {
        bool TryConsume(ServiceStation station, string productName, int quantity, Notifications n);
    }


    /// <summary>
    /// No-op inventory consumer: always succeeds. Replace with real adapter to BottledInventoryService when ready.
    /// </summary>
    public sealed class NoOpInventoryConsumer : IInventoryConsumer
    {
        public bool TryConsume(ServiceStation station, string productName, int quantity, Notifications n)
        {
            // Replace with real consumption logic:
            // - Map productName -> recipe or SKU
            // - Deduct bottles/ml/units via BottledInventoryService
            // - Call n.StockLow / n.StockDepleted when thresholds hit
            return true;
        }
    }
}
