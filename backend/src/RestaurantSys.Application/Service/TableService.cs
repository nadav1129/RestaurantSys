using RestaurantSys.Domain;
using System;

namespace RestaurantSys.Application
{
    public sealed class TableService
    {
        private readonly Notifications _notifications;

        public TableService(Notifications notifications)
        {
            _notifications = notifications;
        }

        /// <summary>
        /// Open a new table; TableId and TableNumber are immutable identifiers that come from your station setup.
        /// </summary>
        public Table OpenTable(Guid tableId, int tableNumber, TableOpenRequest req)
        {
            var table = new Table(tableId, tableNumber)
            {
                Notes = req.Notes,
                Start = req.Start,
                End = req.End,
                MinimumForTable = req.MinimumForTable,
                PhoneNumber = req.PhoneNumber,
                Deposit = req.Deposit
            };
            return table;
        }

        /// <summary>
        /// Add a ready-resolved line to the table (name/qty/price already determined by higher-level logic).
        /// Inventory consumption and catalog lookup should be handled by OrderExecutor before calling this.
        /// </summary>
        public void AddLine(Table table, string displayName, int quantity, decimal unitPrice)
        {
            if (table is null) throw new ArgumentNullException(nameof(table));
            if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity));

            table.Products.Add(new TableLine(displayName, quantity, unitPrice));
            RecalculateTotals(table);
        }

        public void ApplyDiscount(Table table, decimal discountAmount)
        {
            if (table is null) throw new ArgumentNullException(nameof(table));
            if (discountAmount < 0) discountAmount = 0;

            table.AppliedDiscount = discountAmount; /* set discount */
            RecalculateTotals(table);
        }

        public void Pay(Table table, decimal amount)
        {
            if (table is null) throw new ArgumentNullException(nameof(table));
            if (amount < 0) amount = 0;

            table.AmountPaid += amount;

            // If fully paid but bill is still below the minimum (and a minimum exists), notify
            if (table.AmountPaid >= table.AmountToPay &&
                table.MinimumForTable > 0 &&
                table.AmountToPay < table.MinimumForTable)
            {
                _notifications.MinNotMet(table.TableNumber, table.MinimumForTable, table.AmountToPay);
            }
        }

        public void Close(Table table)
        {
            if (table is null) throw new ArgumentNullException(nameof(table));
            if (table.AmountPaid < table.AmountToPay)
                throw new InvalidOperationException("Cannot close table: outstanding balance.");
            table.End = DateTime.UtcNow;
        }

        private static void RecalculateTotals(Table table)
        {
            decimal subtotal = 0m;
            foreach (var line in table.Products)
                subtotal += line.UnitPrice * line.Quantity;

            table.AmountToPay = Math.Max(0, subtotal - table.AppliedDiscount); /* update total */
        }
    }

    public sealed class TableOpenRequest
    {
        public string? Notes { get; set; }
        public DateTime Start { get; set; }
        public DateTime? End { get; set; }
        public decimal MinimumForTable { get; set; }
        public string? PhoneNumber { get; set; }
        public bool Deposit { get; set; }
    }
}
