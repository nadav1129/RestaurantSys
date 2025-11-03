//using System;
//using System.Collections.Generic;
//using System.Linq;
//using RestaurantSys.Domain;
//using RestaurantSys.Application;

//namespace RestaurantSys.ConsoleRunner
//{
//    /*--------------------------------------------------------------------
//    Class: Presentation_Demo
//    Purpose: End-to-end day simulation for presentation:
//             - Seed stations, inventory, prices
//             - Clock workers in/out (shifts)
//             - Open tables, take orders, take payments, close tables
//             - Feed counters (A orders, B payments) for payroll
//             - Compute daily payroll with dynamic C (managers pool)
//             - Print bottle usage snapshot totals at the end
//    --------------------------------------------------------------------*/
//    internal static class Presentation_Demo
//    {
//        public static void Run()
//        {
//            Console.WriteLine("=== PRESENTATION DEMO: Full Day Simulation ===");
//            var tzNow = DateTime.UtcNow;

//            // ---------- 0) Wiring ----------
//            var notifications = new ConsoleNotifications();
//            var inventorySvc = new BottledInventoryService();
//            var stations = StationsAndInventorySetup.CreateStations();
//            StationsAndInventorySetup.AssignTablesToStations(stations);
//            var cv = StationsAndInventorySetup.BuildCatalog();
//            var menu = StationsAndInventorySetup.BuildMenu(cv);
//            StationsAndInventorySetup.SeedInventory_Bar1(inventorySvc, stations, cv);
//            StationsAndInventorySetup.SeedInventory_Bar2(inventorySvc, stations, cv);

//            // Ordering services
//            var prices = new PriceBook();
//            var invCons = new InventoryConsumer(inventorySvc, cv);
//            var tables = new TableService(notifications);
//            var orders = new OrderExecutor(prices, invCons, notifications, tables);

//            // Reservations (example)
//            var resList = new ReservationList();
//            var resSvc = new ReservationService(resList, notifications);

//            // Sales counters (A/B per-day) + time clock + payroll
//            var clockRepo = new InMemoryClockRepository();
//            var totalsRepo = new InMemoryDailyTotalsRepository();
//            var counters = new SalesCountersService(totalsRepo);
//            var day = DateOnly.FromDateTime(DateTime.Now); // assume local day

//            // Payroll config + workers
//            var workers = CreateWorkers();
//            var ids = workers.Keys.ToList();
//            var aliceId = ids[0]; var bobId = ids[1]; var chloeId = ids[2]; var danaId = ids[3];
//            var tipConfig = CreateTipConfig(); // includes dynamic C option via policy
//            ITipPolicy tipPolicy = new ParametricTipPolicy(); // your policy in Domain
//            var payroll = new PayrollService(clockRepo, counters, tipPolicy, tipConfig, workers);

//            // Prices (single source of truth for OrderExecutor)
//            SeedPrices(prices, cv);

//            // ---------- 1) Workers clock-in ----------
//            var start = tzNow.Date.AddHours(9); // 09:00 local (approx; using UTC for demo)
//            ClockIn(clockRepo, aliceId, start, "Bar1");
//            ClockIn(clockRepo, bobId, start, "Bar1");
//            ClockIn(clockRepo, chloeId, start.AddHours(2), "Bar2"); // later shift
//            ClockIn(clockRepo, danaId, start, "Manager");

//            // ---------- 2) Reservation + open tables ----------
//            var r = resSvc.Create(new ReservationCreateRequest
//            {
//                ReserverName = "Team 7",
//                MinimumForTable = 250m,
//                Start = DateTime.Now.AddMinutes(15),
//                End = DateTime.Now.AddHours(3),
//                PhoneNumber = "050-1111111",
//                Notes = "Window seat"
//            });
//            notifications.UpcomingReservation(r);

//            var T11 = tables.OpenTable(Guid.NewGuid(), 11, resSvc.ToOpenTableRequest(r.Id));
//            notifications.TableOpened(T11.TableNumber);

//            var T12 = tables.OpenTable(Guid.NewGuid(), 12, new TableOpenRequest
//            {
//                ReserverName = "Walk-in",
//                MinimumForTable = 0m,
//                Start = DateTime.Now,
//                PhoneNumber = null,
//                Notes = null
//            });
//            notifications.TableOpened(T12.TableNumber);

//            // ---------- 3) Orders flow (with inventory + counters) ----------
//            void OrderItems(Table t, params (string productName, int quantity)[] items)
//            {
//                var before = t.AmountToPay;
//                orders.ExecuteForTable(stations.Bar1, t, items.ToList());
//                var after = t.AmountToPay;
//                var delta = Math.Max(0m, after - before);
//                if (delta > 0) counters.OrderOpened(delta, DateTime.UtcNow);
//            }

//            OrderItems(T11,
//                ("Soft (any) 250ml", 2),
//                (cv.Martini_Bianco_700.Name, 1),
//                (cv.Negroni.Name, 2)
//            );

//            OrderItems(T12,
//                (cv.GG_700.Name, 2),
//                ("Shot + Soft (60ml + 250ml)", 2),
//                ("Alcohol (any) 30ml", 2)
//            );

//            // ---------- 4) Partial payments ----------
//            var p1 = Math.Round(T11.AmountToPay * 0.5m, 2);
//            tables.Pay(T11, p1);
//            counters.PaymentReceived(p1, DateTime.UtcNow);

//            var p2 = Math.Round(T12.AmountToPay * 0.4m, 2);
//            tables.Pay(T12, p2);
//            counters.PaymentReceived(p2, DateTime.UtcNow);

//            // ---------- 5) More orders later ----------
//            OrderItems(T11, (cv.Negroni.Name, 1), ("Alcohol (any) 60ml", 1));

//            // ---------- 6) Close-out ----------
//            tables.ApplyDiscount(T11, 10m);
//            var remainT11 = T11.AmountToPay - T11.AmountPaid;
//            if (remainT11 > 0) { tables.Pay(T11, remainT11); counters.PaymentReceived(remainT11, DateTime.UtcNow); }
//            tables.Close(T11);
//            notifications.TableClosed(T11.TableNumber, T11.AmountPaid);

//            var remainT12 = T12.AmountToPay - T12.AmountPaid;
//            if (remainT12 > 0) { tables.Pay(T12, remainT12); counters.PaymentReceived(remainT12, DateTime.UtcNow); }
//            tables.Close(T12);
//            notifications.TableClosed(T12.TableNumber, T12.AmountPaid);

//            // ---------- 7) Workers clock-out ----------
//            ClockOut(clockRepo, aliceId, start.AddHours(8));  // 17:00
//            ClockOut(clockRepo, bobId, start.AddHours(8));
//            ClockOut(clockRepo, chloeId, start.AddHours(6));  // late shift
//            ClockOut(clockRepo, danaId, start.AddHours(9));  // manager longer

//            // ---------- 8) Report inventory snapshot ----------
//            Console.WriteLine();
//            Console.WriteLine("=== STOCK SNAPSHOT @ Bar1 (end of day) ===");
//            foreach (var s in inventorySvc.All(stations.Bar1).OrderBy(x => x.Product.Name))
//                Console.WriteLine($"- {s.Product.Name,-28} | Bottles: {s.FullBottles,2} | Open: {s.OpenMl,6} ml (thr {s.ThresholdBottles})");

//            // ---------- 9) Payroll ----------
//            var payrollTables = payroll.BuildDailyPayroll(day, DateTime.UtcNow);

//            Console.WriteLine();
//            Console.WriteLine("=== DAILY PAYROLL SUMMARY ===");
//            Console.WriteLine($"A (orders) - B (payments) = Tips: {payrollTables.Summary.A_TotalTips:C}");
//            Console.WriteLine($"After Tax: {payrollTables.Summary.AfterTax:C}");
//            Console.WriteLine($"ManagersPool (C): {payrollTables.Summary.ManagersPool:C}");
//            Console.WriteLine($"StaffPool: {payrollTables.Summary.StaffPool:C}");
//            Console.WriteLine($"TopUp total: {payrollTables.Summary.EstablishmentTopUpTotal:C}");

//            Console.WriteLine("-- Staff table --");
//            foreach (var rrow in payrollTables.StaffTable)
//                Console.WriteLine($"{rrow.WorkerName} ({rrow.Role})  Hours={rrow.Hours}  TipPay={rrow.TipPay:C}  TopUp={rrow.EstablishmentTopUp:C}  Total={rrow.TotalPay:C}");

//            Console.WriteLine("-- Managers table --");
//            foreach (var rrow in payrollTables.ManagersTable)
//                Console.WriteLine($"{rrow.WorkerName} ({rrow.Role})  Hours={rrow.Hours}  TipPay={rrow.TipPay:C}");

//            Console.WriteLine("=== END OF PRESENTATION DEMO ===");
//        }

//        /* --------- helpers --------- */

//        private static void SeedPrices(PriceBook prices, StationsAndInventorySetup.CatalogAndProducts cv)
//        {
//            prices.Set(cv.GG_700.Name, 230m);
//            prices.Set(cv.GG_1L.Name, 300m);
//            prices.Set(cv.Martini_Bianco_700.Name, 120m);
//            prices.Set(cv.Campari_1L.Name, 150m);
//            prices.Set(cv.Negroni.Name, 45m);
//            prices.Set("Soft (any) 250ml", 12m);
//            prices.Set("Alcohol (any) 30ml", 18m);
//            prices.Set("Alcohol (any) 60ml", 28m);
//            prices.Set("Shot + Soft (60ml + 250ml)", 38m);
//        }

//        private static IReadOnlyDictionary<Guid, Worker> CreateWorkers()
//        {
//            var a = new Worker(Guid.NewGuid(), "Alice", "Bartender");
//            var b = new Worker(Guid.NewGuid(), "Bob", "Waiter");
//            var c = new Worker(Guid.NewGuid(), "Chloe", "Waiter");
//            var d = new Worker(Guid.NewGuid(), "Dana", "Manager");
//            return new Dictionary<Guid, Worker>
//            {
//                [a.WorkerId] = a,
//                [b.WorkerId] = b,
//                [c.WorkerId] = c,
//                [d.WorkerId] = d,
//            };
//        }

//        private static TipFormulaConfig CreateTipConfig()
//        {
//            // Example role rules + dynamic C policy
//            var rules = new List<RoleRule>
//            {
//                new RoleRule("Waiter",    EligibleForTips: true,  IsManager: false, FixedHourlyOnly: false, GuaranteedHourly: 35m),
//                new RoleRule("Bartender", EligibleForTips: true,  IsManager: false, FixedHourlyOnly: false, GuaranteedHourly: 40m),
//                new RoleRule("Manager",   EligibleForTips: false, IsManager: true,  FixedHourlyOnly: true,  GuaranteedHourly: 55m),
//            };

//            // Dynamic C: increase managers percentage if total tips exceed a threshold (example policy)
//            return new TipFormulaConfig(
//                TaxPercentB: 0.17m,
//                ManagersPercentC: 0.10m,
//                Rules: rules,
//                ManagersCutPolicy: null
//            );
//        }

//        private static void ClockIn(IClockRepository repo, Guid workerId, DateTime when, string station)
//        {
//            var tcs = new TimeClockService(repo);
//            tcs.ClockIn(workerId, when, station);
//        }

//        private static void ClockOut(IClockRepository repo, Guid workerId, DateTime when)
//        {
//            var tcs = new TimeClockService(repo);
//            tcs.ClockOut(workerId, when);
//        }

//        /* ===== Console notifications & inventory consumer bridge (from BigTestScenario) ===== */

//        private sealed class ConsoleNotifications : Notifications
//        {
//            protected override void Info(string message) => Console.WriteLine($"[INFO  {DateTime.Now:T}] {message}");
//            protected override void Warn(string message) => Console.WriteLine($"[WARN  {DateTime.Now:T}] {message}");
//            protected override void Error(string message) => Console.WriteLine($"[ERROR {DateTime.Now:T}] {message}");

//            public override void TableOpened(int tableNumber) => Info($"Table {tableNumber} opened.");
//            public override void TableClosed(int tableNumber, decimal amountPaid) => Info($"Table {tableNumber} closed. Paid: {amountPaid:C}");
//            public override void UpcomingReservation(Reservation reservation) => Info($"Upcoming reservation for {reservation.ReserverName} at {reservation.Start}.");
//            public override void MinNotMet(int tableNumber, decimal minimum, decimal actual) => Warn($"Table {tableNumber}: minimum {minimum:C} not met (actual {actual:C}).");
//        }

//        private sealed class InventoryConsumer : IInventoryConsumer
//        {
//            private readonly BottledInventoryService _inv;
//            private readonly StationsAndInventorySetup.CatalogAndProducts _cv;

//            public InventoryConsumer(BottledInventoryService inv, StationsAndInventorySetup.CatalogAndProducts cv)
//            {
//                _inv = inv;
//                _cv = cv;
//            }

//            public bool TryConsume(ServiceStation station, string productName, int quantity, Notifications _)
//            {
//                try
//                {
//                    for (int i = 0; i < quantity; i++)
//                        ConsumeOnce(station, productName);
//                    return true;
//                }
//                catch (Exception ex)
//                {
//                    Console.WriteLine($"[WARN  {DateTime.Now:T}] Inventory consume failed for '{productName}': {ex.Message}");
//                    return false;
//                }
//            }

//            private void ConsumeOnce(ServiceStation st, string productName)
//            {
//                if (string.Equals(productName, "Shot + Soft (60ml + 250ml)", StringComparison.OrdinalIgnoreCase))
//                {
//                    _inv.Pour(st, _cv.Alcohol_Vodka, 60m, OnLow);
//                    _inv.Pour(st, _cv.Soft_Lemonade, 250m, OnLow);
//                    return;
//                }

//                if (string.Equals(productName, "Alcohol (any) 60ml", StringComparison.OrdinalIgnoreCase))
//                {
//                    _inv.Pour(st, _cv.Alcohol_Vodka, 60m, OnLow); // default family choice: Vodka
//                    return;
//                }
//                if (string.Equals(productName, "Alcohol (any) 30ml", StringComparison.OrdinalIgnoreCase))
//                {
//                    _inv.Pour(st, _cv.Alcohol_Vodka, 30m, OnLow);
//                    return;
//                }
//                if (string.Equals(productName, "Soft (any) 250ml", StringComparison.OrdinalIgnoreCase))
//                {
//                    _inv.Pour(st, _cv.Soft_Lemonade, 250m, OnLow);
//                    return;
//                }

//                // Specific products (bottles/cocktails)
//                if (string.Equals(productName, _cv.Negroni.Name, StringComparison.OrdinalIgnoreCase))
//                {
//                    // Example: Negroni with possible leading substitution
//                    _inv.Pour(st, _cv.Alcohol_Vodka, 30m, OnLow);
//                    _inv.Pour(st, _cv.Alcohol_Vodka, 30m, OnLow);
//                    _inv.Pour(st, _cv.Alcohol_Vodka, 30m, OnLow);
//                    return;
//                }

//                // Fallback: treat as bottle product -> open & deduct one sealed (handled internally)
//                var product = _cv.LookupByName(productName) ?? throw new InvalidOperationException($"Unknown product '{productName}'.");
//                _inv.SellWholeBottle(st, product: _cv.GG_700, count: 1);
//            }

//            private void OnLow(LowStockEvent e)
//            {
//                Console.WriteLine($"[WARN  {DateTime.Now:T}] LOW @ {e.Station.Name}: {e.SkuLabel} -> {e.FullBottles} bottles left, open {e.OpenMl} ml (≤ {e.ThresholdBottles}).");
//            }
//        }
//    }
//}
