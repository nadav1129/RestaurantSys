using System;
using System.Collections.Generic;
using System.Linq;
using RestaurantSys.Domain;

namespace RestaurantSys.Application
{
    /// <summary>
    /// Per-station bottled inventory for the simplified Product model.
    /// - Tracks sealed bottles and the remaining milliliters in an opened bottle ("OpenMl").
    /// - Supports pouring by ingredient family (Ingredient) or by exact bottle Product.
    /// - Provides an atomic batch pour for multi-component drinks (e.g., cocktails).
    /// - Emits low-stock info via a callback (and can later be wired to Notifications).
    /// </summary>
    public sealed class BottledInventoryService
    {
        /* ===================== Policy & Events ===================== */

        /// <summary>What to do when approaching/at threshold.</summary>
        public enum LowStockPolicy
        {
            WarnOnly,              /* Allow operation; just emit event. */
            BlockBelowThreshold    /* Block operations that would leave ≤ threshold bottles. */
        }

        /// <summary>
        /// Lightweight event describing a low/depleted situation for a specific bottle Product at a station.
        /// </summary>
        public readonly record struct LowStockEvent(
            Station Station,          /* Station that owns this stock (e.g., Bar1). */
            Product Product,          /* Exact bottle Product (must be ProductType.Bottle). */
            int RemainingBottles,     /* Sealed bottles remaining after the operation. */
            decimal OpenMl,           /* Remaining ml in the currently-open bottle (0 means none). */
            int ThresholdBottles      /* Threshold configured for this Product at this station. */
        );

        /* ===================== Construction ===================== */

        private readonly LowStockPolicy _policy;                                /* Policy for threshold behavior. */
        private readonly Dictionary<Guid, StationInventory> _byStation = new(); /* Station.Id -> StationInventory */

        public BottledInventoryService(LowStockPolicy policy = LowStockPolicy.WarnOnly)
        {
            _policy = policy;
        }

        /* ===================== Public Stock Model ===================== */

        /// <summary>
        /// Represents stock for one bottle Product at a given station.
        /// </summary>
        public sealed class Stock
        {
            public Product Product { get; }       /* The bottle SKU (ProductType.Bottle). */
            public int FullBottles { get; set; }  /* Count of sealed bottles. */
            public decimal OpenMl { get; set; }   /* Remaining ml in the currently-open bottle; 0 => none open. */
            public int ThresholdBottles { get; set; } /* Alert threshold (when FullBottles <= ThresholdBottles). */

            public Stock(Product product, int bottles, int threshold, decimal openMl = 0)
            {
                if (!product.IsBottle) throw new InvalidOperationException("Stock can only be created for bottle products.");
                Product = product;
                FullBottles = bottles;
                OpenMl = openMl;
                ThresholdBottles = threshold;
            }

            public decimal PackageMl => Product.BottleComponent.AmountMl; /* Size of one sealed bottle in ml. */
            public Ingredient Ingredient => Product.BottleComponent.Ingredient; /* Ingredient family of this bottle. */

            public override string ToString()
                => $"{Product.Name} : {FullBottles} bottles | open {OpenMl} ml (≤ {ThresholdBottles})";
        }

        /* ===================== Internal Per-Station Indexes ===================== */

        private sealed class StationInventory
        {
            public Dictionary<Guid, Stock> ByProductId { get; } = new();          /* Product.Id -> Stock (fast exact lookup). */
            public Dictionary<Guid, List<Stock>> ByIngredientId { get; } = new(); /* Ingredient.Id -> variant stocks (for family pours). */
            public object Gate { get; } = new();                                   /* Lock to guard concurrent updates per station. */
        }

        /* ===================== CRUD-like Operations ===================== */

        /// <summary>Insert or replace stock for a bottle Product at a station.</summary>
        public void Upsert(Station station, Product bottleProduct, int fullBottles, int thresholdBottles, decimal openMl = 0)
        {
            if (station is null) throw new ArgumentNullException(nameof(station));
            if (bottleProduct is null) throw new ArgumentNullException(nameof(bottleProduct));
            if (!bottleProduct.IsBottle) throw new InvalidOperationException("Upsert expects a bottle product.");

            var inv = GetInv(station);
            lock (inv.Gate)
            {
                if (!inv.ByProductId.TryGetValue(bottleProduct.Id, out var stock))
                {
                    stock = new Stock(bottleProduct, fullBottles, thresholdBottles, openMl);
                    inv.ByProductId[bottleProduct.Id] = stock;

                    var ingId = stock.Ingredient.Id;
                    if (!inv.ByIngredientId.TryGetValue(ingId, out var list))
                    {
                        list = new List<Stock>();
                        inv.ByIngredientId[ingId] = list;
                    }
                    list.Add(stock);
                }
                else
                {
                    stock.FullBottles = fullBottles;
                    stock.ThresholdBottles = thresholdBottles;
                    stock.OpenMl = openMl;
                }
            }
        }

        /// <summary>Enumerate all stocks at a station (snapshot copy).</summary>
        public IEnumerable<Stock> All(Station station)
        {
            var inv = GetInv(station);
            lock (inv.Gate)
                return inv.ByProductId.Values.ToList();
        }

        /// <summary>Add sealed bottles for a bottle Product at a station.</summary>
        public void Receive(Station station, Product bottleProduct, int bottles)
        {
            if (bottles <= 0) return;
            var inv = GetInv(station);
            lock (inv.Gate)
            {
                var stock = Require(inv, bottleProduct);
                stock.FullBottles += bottles;
                // If you later update Notifications to accept Product, call it here.
            }
        }

        /// <summary>Sell whole sealed bottles (no open-ml interaction).</summary>
        public void SellWholeBottle(Station station, Product bottleProduct, int count = 1)
        {
            if (count <= 0) return;

            var inv = GetInv(station);
            lock (inv.Gate)
            {
                var stock = Require(inv, bottleProduct);
                EnsureCanDecrementBottles(stock, count);
                stock.FullBottles -= count;
                MaybeNotifyLow(station, stock, onLow: null);
            }
        }

        /* ===================== Pouring APIs ===================== */

        /// <summary>
        /// Pour by ingredient family (any bottle of this ingredient may be used).
        /// Prefers open remainders (largest OpenMl first). If none, opens a new bottle with the most FullBottles.
        /// </summary>
        public void Pour(Station station, Ingredient ingredient, decimal ml, Action<LowStockEvent>? onLow = null)
        {
            if (ml <= 0) return;

            var inv = GetInv(station);
            lock (inv.Gate)
            {
                var list = GetBottleList(inv, ingredient);
                PourFromList(station, list, ml, onLow);
            }
        }

        /// <summary>
        /// Pour from an exact bottle Product (brand/size). Uses/opens only this SKU.
        /// </summary>
        public void PourExact(Station station, Product bottleProduct, decimal ml, Action<LowStockEvent>? onLow = null)
        {
            if (ml <= 0) return;
            if (!bottleProduct.IsBottle) throw new InvalidOperationException("PourExact expects a bottle product.");

            var inv = GetInv(station);
            lock (inv.Gate)
            {
                var stock = Require(inv, bottleProduct);
                PourFromSingle(station, stock, ml, onLow);
            }
        }

        /// <summary>
        /// Atomically pour multiple exact bottle components (e.g., a cocktail designed to be brand-specific).
        /// If any component cannot be satisfied, nothing is mutated and an exception is thrown.
        /// </summary>
        public void PourBatchExact(Station station, IEnumerable<(Product bottleProduct, decimal ml)> components, Action<LowStockEvent>? onLow = null)
        {
            if (components is null) throw new ArgumentNullException(nameof(components));
            var comp = components.ToList();
            if (comp.Count == 0) return;

            var inv = GetInv(station);
            lock (inv.Gate)
            {
                // 1) Dry-run plan
                var plan = new List<Action>();
                foreach (var (product, ml) in comp)
                {
                    if (!product.IsBottle) throw new InvalidOperationException("PourBatchExact expects bottle products only.");
                    if (ml <= 0) continue;

                    var stock = Require(inv, product);
                    PlanPourFromSingle(station, stock, ml, plan, onLow); // throws on infeasible
                }

                // 2) Commit all mutations
                foreach (var step in plan) step();
            }
        }

        /* ===================== Core Algorithms ===================== */

        private void PourFromList(Station station, List<Stock> list, decimal ml, Action<LowStockEvent>? onLow)
        {
            var remaining = ml;

            while (remaining > 0.0001m)
            {
                // 1) Use the largest open remainder first (if any).
                var open = list.Where(x => x.OpenMl > 0).OrderByDescending(x => x.OpenMl).FirstOrDefault();
                if (open is not null)
                {
                    var take = Math.Min(open.OpenMl, remaining);
                    open.OpenMl -= take;
                    remaining -= take;
                    MaybeNotifyLow(station, open, onLow);
                    continue;
                }

                // 2) No open bottle: open the bottle with the most sealed bottles.
                var withBottles = list.Where(x => x.FullBottles > 0).OrderByDescending(x => x.FullBottles).FirstOrDefault();
                if (withBottles is null)
                    throw new InvalidOperationException($"Not enough stock to pour {ml} ml.");

                EnsureOpenNewAllowed(withBottles);
                withBottles.FullBottles -= 1;
                withBottles.OpenMl = withBottles.PackageMl;

                MaybeNotifyLow(station, withBottles, onLow);
            }
        }

        private void PourFromSingle(Station station, Stock st, decimal ml, Action<LowStockEvent>? onLow)
        {
            var remaining = ml;

            while (remaining > 0.0001m)
            {
                if (st.OpenMl > 0)
                {
                    var take = Math.Min(st.OpenMl, remaining);
                    st.OpenMl -= take;
                    remaining -= take;
                    MaybeNotifyLow(station, st, onLow);
                    continue;
                }

                if (st.FullBottles <= 0)
                    throw new InvalidOperationException($"Not enough stock of {st.Product.Name} to pour {ml} ml.");

                EnsureOpenNewAllowed(st);
                st.FullBottles -= 1;
                st.OpenMl = st.PackageMl;

                MaybeNotifyLow(station, st, onLow);
            }
        }

        private void PlanPourFromSingle(Station station, Stock st, decimal ml, List<Action> plan, Action<LowStockEvent>? onLow)
        {
            // Simulate consumption using locals; append a commit step if feasible.
            var simFull = st.FullBottles;
            var simOpen = st.OpenMl;
            var remaining = ml;
            var willNotify = false;

            while (remaining > 0.0001m)
            {
                if (simOpen > 0)
                {
                    var take = Math.Min(simOpen, remaining);
                    simOpen -= take;
                    remaining -= take;
                    willNotify = true;
                    continue;
                }

                if (simFull <= 0)
                    throw new InvalidOperationException($"Not enough stock of {st.Product.Name} to pour {ml} ml.");

                EnsureOpenNewAllowed(simFull, st.ThresholdBottles);
                simFull -= 1;
                simOpen = st.PackageMl;
                willNotify = true;
            }

            plan.Add(() =>
            {
                st.FullBottles = simFull;
                st.OpenMl = simOpen;
                if (willNotify) MaybeNotifyLow(station, st, onLow);
            });
        }

        /* ===================== Threshold/Policy Helpers ===================== */

        private void EnsureCanDecrementBottles(Stock st, int delta)
        {
            if (st.FullBottles < delta)
                throw new InvalidOperationException($"Insufficient bottles of {st.Product.Name} (need {delta}, have {st.FullBottles}).");

            if (_policy == LowStockPolicy.BlockBelowThreshold && (st.FullBottles - delta) <= st.ThresholdBottles)
                throw new InvalidOperationException($"Policy blocks sale: {st.Product.Name} would fall to threshold or below.");
        }

        private void EnsureOpenNewAllowed(Stock st)
            => EnsureOpenNewAllowed(st.FullBottles, st.ThresholdBottles);

        private void EnsureOpenNewAllowed(int fullBottles, int threshold)
        {
            if (_policy == LowStockPolicy.BlockBelowThreshold && (fullBottles - 1) <= threshold)
                throw new InvalidOperationException("Policy blocks opening a new bottle at/under threshold.");
        }

        private void MaybeNotifyLow(Station station, Stock st, Action<LowStockEvent>? onLow = null)
        {
            if (st.FullBottles <= st.ThresholdBottles)
                onLow?.Invoke(new LowStockEvent(station, st.Product, st.FullBottles, st.OpenMl, st.ThresholdBottles));
        }

        /* ===================== Lookups & Accessors ===================== */

        private static Stock Require(StationInventory inv, Product bottleProduct)
        {
            if (!inv.ByProductId.TryGetValue(bottleProduct.Id, out var st))
                throw new InvalidOperationException($"No stock for {bottleProduct.Name}.");
            return st;
        }

        private static List<Stock> GetBottleList(StationInventory inv, Ingredient ingredient)
        {
            if (!inv.ByIngredientId.TryGetValue(ingredient.Id, out var list) || list.Count == 0)
                throw new InvalidOperationException($"No bottle products for ingredient {ingredient.Name}.");
            return list;
        }

        private StationInventory GetInv(Station station)
        {
            if (station is null) throw new ArgumentNullException(nameof(station));
            if (!_byStation.TryGetValue(station.Id, out var inv))
            {
                inv = new StationInventory();
                _byStation[station.Id] = inv;
            }
            return inv;
        }
    }
}
