// File: DaySimulation.cs
using System;
using System.Collections.Generic;
using System.Linq;
using Npgsql;
using RestaurantSys.Domain;
using RestaurantSys.Application;
namespace RestaurantSys.Application.Simulation
{
    public static class DaySimulation
{
    public static DailyPayrollTables Run(
        NpgsqlDataSource db,
        TipFormulaConfig tipConfig,
        IReadOnlyDictionary<Guid, Worker> workers,
        Action<string>? log = null)
    {
        log ??= Console.WriteLine;

        // A/B totals store + counters
        var totalsRepo = new InMemoryDailyTotalsRepository();
        var counters = new SalesCountersService(totalsRepo);

        // ======= Your existing setup (catalog/menu/stations/inventory/prices) =======
        var notifications = new Notifications();
        var inventorySvc = new BottledInventoryService();
        var stations = StationsAndInventorySetup.CreateStations();
        StationsAndInventorySetup.AssignTablesToStations(stations);
        var cv = StationsAndInventorySetup.BuildCatalog();
        var menu = StationsAndInventorySetup.BuildMenu(cv);

        StationsAndInventorySetup.SeedInventory_Bar1(inventorySvc, stations, cv);
        StationsAndInventorySetup.SeedInventory_Bar2(inventorySvc, stations, cv);

        var prices = new PriceBook();
        prices.Set(cv.GG_700.Name, 230m);
        prices.Set(cv.GG_1L.Name, 300m);
        prices.Set(cv.Martini_Bianco_700.Name, 120m);
        prices.Set(cv.Campari_1L.Name, 150m);
        prices.Set(cv.Negroni.Name, 45m);
        prices.Set("Soft (any) 250ml", 12m);
        prices.Set("Alcohol (any) 30ml", 18m);
        prices.Set("Alcohol (any) 60ml", 28m);
        prices.Set("Shot + Soft (60ml + 250ml)", 38m);

        var tables = new TableService(notifications);
        var invCons = new InventoryConsumer(inventorySvc, cv);
        var orders = new OrderExecutor(prices, invCons, notifications, tables);

        // Helpers that also feed A/B counters
        void OrderItems(Table t, params (string name, int qty)[] items)
        {
            var before = t.AmountToPay;
            orders.ExecuteForTable(stations.Bar1, t, items.ToList());
            var delta = Math.Max(0m, t.AmountToPay - before);
            if (delta > 0) counters.OrderOpened(delta, DateTime.UtcNow);
        }
        void Pay(Table t, decimal amount)
        {
            tables.Pay(t, amount);
            counters.PaymentReceived(amount, DateTime.UtcNow);
        }

        // ======= Simulate a couple of tables for the demo =======
        var T11 = tables.OpenTable(Guid.NewGuid(), 11, new TableOpenRequest { Start = DateTime.UtcNow, MinimumForTable = 200m });
        var T12 = tables.OpenTable(Guid.NewGuid(), 12, new TableOpenRequest { Start = DateTime.UtcNow });

        OrderItems(T11, ("Soft (any) 250ml", 1), (cv.Martini_Bianco_700.Name, 1), (cv.Negroni.Name, 1));
        OrderItems(T12, (cv.GG_700.Name, 3), ("Shot + Soft (60ml + 250ml)", 1), ("Alcohol (any) 60ml", 1));

        Pay(T11, Math.Round(T11.AmountToPay * 0.6m, 2));
        Pay(T12, Math.Round(T12.AmountToPay * 0.5m, 2));

        var r11 = T11.AmountToPay - T11.AmountPaid; if (r11 > 0) Pay(T11, r11);
        tables.Close(T11);
        var r12 = T12.AmountToPay - T12.AmountPaid; if (r12 > 0) Pay(T12, r12);
        tables.Close(T12);

        // ======= Payroll: WhatsApp shifts + counters =======
        var day = DateOnly.FromDateTime(DateTime.UtcNow);
        var clockRepo = new PgClockRepository(db); // implements IClockRepository (sync)
        var tipPolicy = new ParametricTipPolicy();
        var payroll = new PayrollService(clockRepo, counters, tipPolicy, tipConfig, workers);

        var result = payroll.BuildDailyPayroll(day, DateTime.UtcNow);  // -> DailyPayrollTables
        log($"Tips A={result.Summary.A_TotalTips} AfterTax={result.Summary.AfterTax} StaffPool={result.Summary.StaffPool} ManagersPool={result.Summary.ManagersPool}");
        return result;
    }
}
}