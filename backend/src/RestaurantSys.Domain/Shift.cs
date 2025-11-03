using System;
using Npgsql;
namespace RestaurantSys.Domain;

/*--------------------------------------------------------------------
Class: Shift
Purpose: Represents a worker’s shift session with start/end timestamps
         and optional station. Used to calculate total working hours.
--------------------------------------------------------------------*/

public sealed class Shift
{
    public Guid ShiftId { get; } = Guid.NewGuid();
    public Guid WorkerId { get; }
    public DateTime Start { get; }
    public DateTime? End { get; private set; }
    public string? StationName { get; }

    public Shift(Guid workerId, DateTime startUtc, DateTime? endUtc =  null, string? stationName = null)
    {
        WorkerId = workerId;
        Start = startUtc;
        StationName = stationName;
        if (endUtc != null)
        {
            ClockOut(endUtc);
        }
    }

    public void ClockOut(DateTime ? endUtc)
    {
        if (End is not null) throw new InvalidOperationException("Shift already ended.");
        if (endUtc < Start) throw new ArgumentException("End cannot be before start.");
        End = endUtc;
    }

    public TimeSpan GetDuration() => (End ?? DateTime.UtcNow) - Start;
}
