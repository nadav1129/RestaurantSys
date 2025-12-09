// File: Demo_TipsConfig.cs
using Npgsql;
using RestaurantSys.Application;
using RestaurantSys.Domain;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

public static class Demo_TipsConfig
{
    // was: public static async void Run()
    public static async Task<DailyPayrollTables> RunAsync()
    {
        await using var db = NpgsqlDataSource.Create("Host=localhost;Port=5433;Username=postgres;Password=postgres;Database=postgres");
        var clockRepo = new PgClockRepository(db);
        var totalsRepo = new InMemoryDailyTotalsRepository();
        var counters = new SalesCountersService(totalsRepo);

        var config = new TipFormulaConfig(
            TaxPercentB: 12.0m,
            ManagersPercentC: 10.0m,
            Rules: new[]
            {
                new RoleRule("Waiter",      EligibleForTips:true,  IsManager:false, FixedHourlyOnly:false, GuaranteedHourly: 45m),
                new RoleRule("Hostess",     EligibleForTips:true,  IsManager:false, FixedHourlyOnly:false, GuaranteedHourly: 40m),
                new RoleRule("Bartender",   EligibleForTips:true,  IsManager:false, FixedHourlyOnly:false, GuaranteedHourly: 50m),
                new RoleRule("Dishwasher",  EligibleForTips:false, IsManager:false, FixedHourlyOnly:true,  GuaranteedHourly: null),
                new RoleRule("Manager",     EligibleForTips:false, IsManager:true,  FixedHourlyOnly:false, GuaranteedHourly: null)
            }
        );

        var tipPolicy = new ParametricTipPolicy();

        // Demo workers (in-memory; independent of WhatsApp workers)
        var w1 = new Worker(Guid.NewGuid(), "Dana", "Bartender");
        var w2 = new Worker(Guid.NewGuid(), "Amit", "Waiter");
        var w3 = new Worker(Guid.NewGuid(), "Noa", "Hostess");
        var w4 = new Worker(Guid.NewGuid(), "Erez", "Dishwasher");
        var w5 = new Worker(Guid.NewGuid(), "Lior", "Manager");

        var workers = new Dictionary<Guid, Worker>
        {
            [w1.WorkerId] = w1,
            [w2.WorkerId] = w2,
            [w3.WorkerId] = w3,
            [w4.WorkerId] = w4,
            [w5.WorkerId] = w5,
        };

        var payroll = new PayrollService(clockRepo, counters, tipPolicy, config, workers);

        var day = DateOnly.FromDateTime(DateTime.UtcNow);
        var t0 = DateTime.UtcNow.AddHours(-6);

        // Clock in/out (writes to shift_events via PgClockRepository’s AddShift/TimeClockService)
        var clock = new TimeClockService(clockRepo);
        clock.ClockIn(w1.WorkerId, t0, "Bar1");
        clock.ClockIn(w2.WorkerId, t0, "Floor");
        clock.ClockIn(w3.WorkerId, t0.AddMinutes(30), "Front");
        clock.ClockIn(w4.WorkerId, t0, "Back");
        clock.ClockIn(w5.WorkerId, t0.AddHours(-1), "Office");
        clock.ClockOut(w1.WorkerId, DateTime.UtcNow.AddHours(-1));
        clock.ClockOut(w2.WorkerId, DateTime.UtcNow);
        clock.ClockOut(w3.WorkerId, DateTime.UtcNow);
        clock.ClockOut(w4.WorkerId, DateTime.UtcNow);
        clock.ClockOut(w5.WorkerId, DateTime.UtcNow);

        // Orders / Payments → counters (A = Orders - Payments)
        counters.OrderOpened(1500m, t0.AddMinutes(15));
        counters.PaymentReceived(1200m, t0.AddMinutes(120));

        var result = payroll.BuildDailyPayroll(day, DateTime.UtcNow);

        // Console summary (kept from your version)
        Console.WriteLine($"A={result.Summary.A_TotalTips}, AfterTax={result.Summary.AfterTax}, StaffPool={result.Summary.StaffPool}, ManagersPool={result.Summary.ManagersPool}");
        Console.WriteLine($"Staff hourly={result.Summary.StaffHourlyRate}, Managers hourly={result.Summary.ManagersHourlyRate}, TopUp={result.Summary.EstablishmentTopUpTotal}");
        Console.WriteLine("-- Staff table --");
        foreach (var r in result.StaffTable)
            Console.WriteLine($"{r.WorkerName} ({r.Role}) Hours={r.Hours} TipPay={r.TipPay} TopUp={r.EstablishmentTopUp} Total={r.TotalPay}");
        Console.WriteLine("-- Managers table --");
        foreach (var r in result.ManagersTable)
            Console.WriteLine($"{r.WorkerName} ({r.Role}) Hours={r.Hours} TipPay={r.TipPay}");

        return result;
    }
}
