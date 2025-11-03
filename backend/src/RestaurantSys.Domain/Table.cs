using System;
using System.Collections.Generic;

namespace RestaurantSys.Domain
{
    /* ======================= TABLE DOMAIN ======================= */

    /// <summary>
    /// Represents a single table in the restaurant.
    /// Tracks its identity, billing info, and lifecycle (open → close).
    /// </summary>
    public sealed class Table
    {
        public Guid TableId { get; }            // Unique technical identifier (system-level identity).
        public int TableNumber { get; }         // Human-facing table number (e.g., 11).

        public string? Notes { get; set; }      // Free-text notes (e.g. "Birthday", "Window seat").
        public DateTime Start { get; set; }     // When the table was opened.
        public DateTime? End { get; set; }      // When the table was closed (null = still open).
        public decimal MinimumForTable { get; set; } // Minimum spend requirement (0 = none).
        public string? PhoneNumber { get; set; }      // Optional customer phone (often from reservation).
        public bool Deposit { get; set; }            // Flag if a deposit has been taken.

        public List<TableLine> Products { get; } = new(); // All ordered items (flat bill lines).
        public decimal AmountToPay { get; set; }          // Current total bill (after discount).
        public decimal AmountPaid { get; set; }           // How much has been paid so far.
        public decimal AppliedDiscount { get; set; }      // Discount applied (flat amount).

        public Table(Guid tableId, int tableNumber)
        {
            TableId = tableId;
            TableNumber = tableNumber;
        }
    }

    /// <summary>
    /// A single line item on a table's bill.
    /// Immutable snapshot: stores display name, qty, and price at the time of order.
    /// </summary>
    public sealed class TableLine
    {
        public string ProductName { get; }     // Display label (from Catalog/Menu).
        public int Quantity { get; }           // Ordered quantity.
        public decimal UnitPrice { get; }      // Price per unit at the time of order.

        public TableLine(string productName, int quantity, decimal unitPrice)
        {
            ProductName = productName;
            Quantity = quantity;
            UnitPrice = unitPrice;
        }
    }

    /* ======================= RESERVATIONS ======================= */

    /// <summary>
    /// Lifecycle states of a reservation.
    /// </summary>
    public enum ReservationStatus
    {
        Created,    // Reservation has been created but not yet seated.
        Seated,     // Reservation is now at a table.
        Completed,  // Reservation completed successfully (optional status).
        NoShow,     // Customer did not arrive.
        Canceled    // Reservation was cancelled.
    }

    /// <summary>
    /// Reservation details for a customer.
    /// Includes who reserved, when, optional notes, and lifecycle state.
    /// </summary>
    public sealed class Reservation
    {
        public Guid Id { get; set; }                     // Unique identifier for the reservation.
        public string ReserverName { get; set; } = "";   // Name of the person reserving.
        public decimal MinimumForTable { get; set; }     // Minimum spend required (if any).
        public DateTime Start { get; set; }              // When the reservation starts.
        public DateTime? End { get; set; }               // Optional end time.
        public string PhoneNumber { get; set; } = "";    // Contact phone number.
        public string? Notes { get; set; }               // Optional notes (allergies, preferences, etc.).
        public ReservationStatus Status { get; set; } = ReservationStatus.Created; // Lifecycle state.
    }

    /// <summary>
    /// In-memory list of reservations, indexed by Id.
    /// Provides add/get/all operations.
    /// </summary>
    public sealed class ReservationList
    {
        private readonly Dictionary<Guid, Reservation> _byId = new(); // internal store.

        public void Add(Reservation r) => _byId[r.Id] = r;   // Insert or overwrite by Id.
        public Reservation? Get(Guid id)                     // Fetch reservation by Id (null if missing).
            => _byId.TryGetValue(id, out var r) ? r : null;
        public IEnumerable<Reservation> All()                // Enumerate all reservations.
            => _byId.Values;
    }
}
