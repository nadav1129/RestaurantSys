// File: TimeClockService.cs
using RestaurantSys.Domain;
using System;

namespace RestaurantSys.Application;


/*--------------------------------------------------------------------
Class: TimeClockService
Purpose: High-level API for workers to clock in and out.
         Ensures one open shift per worker at a time.
--------------------------------------------------------------------*/

public sealed class TimeClockService
{
    private readonly IClockRepository _repo;

    public TimeClockService(IClockRepository repo) => _repo = repo;

    public Shift ClockIn(Guid workerId, DateTime nowUtc, string? stationName = null)
    {
        if (_repo.GetOpenShift(workerId) is not null)
            throw new InvalidOperationException("Worker already clocked in.");
        var shift = new Shift(workerId, nowUtc);
        _repo.AddShift(shift);
        return shift;
    }

    public Shift ClockOut(Guid workerId, DateTime nowUtc)
    {
        var open = _repo.GetOpenShift(workerId) ?? throw new InvalidOperationException("No open shift.");
        open.ClockOut(nowUtc);
        return open;
    }
}
