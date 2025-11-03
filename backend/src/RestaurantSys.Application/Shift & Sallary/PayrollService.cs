// File: PayrollService.cs
using RestaurantSys.Domain;
using System;
using System.Collections.Generic;
using System.Linq;

namespace RestaurantSys.Application;

/*--------------------------------------------------------------------
Record: DailyPayrollTables
Purpose: Combined result object for daily payroll computation,
         including summary + staff table + manager table.
--------------------------------------------------------------------*/
public sealed record DailyPayrollTables(
    TipComputationSummary Summary,
    IReadOnlyList<TipRow> StaffTable,    /* group D, with top-ups applied if needed */
    IReadOnlyList<TipRow> ManagersTable  /* C% pool */
);

/*--------------------------------------------------------------------
Class: PayrollService
Purpose: Orchestrates the full daily payroll calculation:
         gathers shifts/hours, applies the tip policy, and produces
         staff & manager payout tables plus a summary.
--------------------------------------------------------------------*/
public sealed class PayrollService
{
    private readonly IClockRepository _clockRepo;
    private readonly SalesCountersService _counters;
    private readonly ITipPolicy _tipPolicy;
    private readonly TipFormulaConfig _config;
    private readonly IReadOnlyDictionary<Guid, Worker> _workersById;

    public PayrollService(
        IClockRepository clockRepo,
        SalesCountersService counters,
        ITipPolicy tipPolicy,
        TipFormulaConfig config,
        IReadOnlyDictionary<Guid, Worker> workersById)
    {
        _clockRepo = clockRepo;
        _counters = counters;
        _tipPolicy = tipPolicy;
        _config = config;
        _workersById = workersById;
    }

    public DailyPayrollTables BuildDailyPayroll(DateOnly day, DateTime nowUtc)
    {
        // A = total tips (your spec: A = total order tips; we read as A = counters.Tips = (A_orders - B_payments))
        var totals = _counters.GetDaily(day);
        var A = totals.Tips;

        // Hours per worker for the day (clips open shifts at nowUtc)
        var shifts = _clockRepo.GetShifts(day);
        var hoursByWorker = shifts
            .GroupBy(s => s.WorkerId)
            .Select(g =>
            {
                var hours = g.Sum(s =>
                {
                    var end = s.End ?? nowUtc;
                    return (decimal)(end - s.Start).TotalHours;
                });
                var w = _workersById.TryGetValue(g.Key, out var wk)
                        ? wk
                        : new Worker(g.Key, $"Worker-{g.Key.ToString()[..6]}", null);
                return (g.Key, w.FullName, w.Role, Hours: Math.Round(hours, 2));
            })
            .Where(x => x.Hours > 0m)
            .ToList();

        var (summary, staffRows, managerRows) = _tipPolicy.Compute(_config, A, hoursByWorker);
        return new DailyPayrollTables(summary, staffRows, managerRows);
    }
}
