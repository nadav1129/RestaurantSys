using RestaurantSys.Domain;
using System;
using System.Collections.Generic;

namespace RestaurantSys.Application;

public sealed class ReservationService
{
    private readonly ReservationList _reservations;
    private readonly Notifications _notifications;

    public ReservationService(ReservationList reservations, Notifications notifications)
    {
        _reservations = reservations;
        _notifications = notifications;
    }

    public Reservation Create(ReservationCreateRequest req)
    {
        // (Optional) check for overlaps by phone/name/time
        var r = new Reservation
        {
            Id = Guid.NewGuid(),
            ReserverName = req.ReserverName,
            MinimumForTable = req.MinimumForTable,
            Start = req.Start,
            End = req.End,
            PhoneNumber = req.PhoneNumber,
            Notes = req.Notes,
            Status = ReservationStatus.Created
        };
        _reservations.Add(r);
        return r;
    }

    public void Cancel(Guid reservationId)
    {
        var r = _reservations.Get(reservationId) ?? throw new InvalidOperationException("Reservation not found.");
        r.Status = ReservationStatus.Canceled;
    }

    // QUICK FLOW: seat a reservation -> open a table prefilled
    public TableOpenRequest ToOpenTableRequest(Guid reservationId)
    {
        var r = _reservations.Get(reservationId) ?? throw new InvalidOperationException("Reservation not found.");
        r.Status = ReservationStatus.Seated;

        return new TableOpenRequest
        {
            Notes = r.Notes,
            Start = r.Start,
            End = r.End,
            MinimumForTable = r.MinimumForTable,
            PhoneNumber = r.PhoneNumber,
            Deposit = false // as you said: keep flag available but not enforced by default
        };
    }

    public IEnumerable<Reservation> Upcoming(TimeSpan window)
    {
        var now = DateTime.UtcNow;
        foreach (var r in _reservations.All())
            if (r.Status == ReservationStatus.Created && r.Start <= now + window && r.Start >= now)
                yield return r;
    }
}

public sealed class ReservationCreateRequest
{
    public string ReserverName { get; set; } = "";
    public decimal MinimumForTable { get; set; }
    public DateTime Start { get; set; }
    public DateTime? End { get; set; }
    public string PhoneNumber { get; set; } = "";
    public string? Notes { get; set; }
}
