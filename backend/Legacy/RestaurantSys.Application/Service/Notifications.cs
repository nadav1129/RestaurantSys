using System;
using RestaurantSys.Domain;

namespace RestaurantSys.Application;

/// <summary>
/// Central notification hub. Wire this to logs, UI toasts, webhooks, etc.
/// Keep the surface small & semantic; Application layer calls these strongly-typed helpers.
/// </summary>
public class Notifications
{
    /* Base sinks (replace with your infra as needed) */
    protected virtual void Info(string message) { /* log/emit */ }
    protected virtual void Warn(string message) { /* log/emit */ }
    protected virtual void Error(string message) { /* log/emit */ }

    /* ===== Inventory ===== */

    public void StockLow(ServiceStation station, Product product, int remainingBottles, int thresholdBottles)
        => Warn($"[{station.Name}] Low stock: {product.Name} — {remainingBottles} left (threshold {thresholdBottles}).");

    public void StockDepleted(ServiceStation station, Product product)
        => Error($"[{station.Name}] OUT OF STOCK: {product.Name}.");

    public void StockReplenished(ServiceStation station, Product product, int addedBottles, int totalNow)
        => Info($"[{station.Name}] Replenished: {product.Name} +{addedBottles} ? {totalNow}.");

    /* ===== Orders / Tables ===== */

    public void OrderSucceeded(int tableNumber, decimal subtotal, decimal amountToPay)
        => Info($"[Table {tableNumber}] Order OK. Subtotal {subtotal:C}, To pay {amountToPay:C}.");

    public void OrderFailed(int tableNumber, string reason)
        => Error($"[Table {tableNumber}] Order FAILED: {reason}");

    public void MinNotMet(int tableNumber, decimal minimum, decimal amountToPay)
        => Warn($"[Table {tableNumber}] Minimum {minimum:C} not met. Current bill {amountToPay:C}.");

    public void TableClosed(int tableNumber, decimal amountPaid)
        => Info($"[Table {tableNumber}] Closed. Paid {amountPaid:C}.");

    /* ===== Reservations (optional hooks) ===== */

    public void UpcomingReservation(Reservation reservation)
        => Info($"[Reservations] Upcoming: {reservation.ReserverName} at {reservation.Start:t} (Phone {reservation.PhoneNumber}).");

    public void ReservationSeated(Reservation reservation, int tableNumber)
        => Info($"[Reservations] Seated: {reservation.ReserverName} ? Table {tableNumber}.");

    public void ReservationNoShow(Reservation reservation)
        => Warn($"[Reservations] No-show: {reservation.ReserverName} at {reservation.Start:t} (Phone {reservation.PhoneNumber}).");
}
