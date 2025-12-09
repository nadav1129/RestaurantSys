// File: ParametricTipPolicy.cs
using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;

namespace RestaurantSys.Domain;

/*--------------------------------------------------------------------
Class: ParametricTipPolicy
Purpose: Implements ITipPolicy following the full 7-step formula:
         1. Take A
         2. Remove B%
         3. Remove C% (dynamic or fixed)
         4. Select eligible roles D
         5. Sum hours of D
         6. Compute hourly rate (pool / Σhours)
         7. Multiply by hours, applying top-ups if below guarantee.
--------------------------------------------------------------------*/
public sealed class ParametricTipPolicy : ITipPolicy
{
    public (
    TipComputationSummary Summary,
    IReadOnlyList<TipRow> StaffRows,
    IReadOnlyList<TipRow> ManagerRows
) Compute(
    TipFormulaConfig config,
    decimal A_TotalTips,
    IReadOnlyList<(Guid WorkerId, string Name, string? Role, decimal Hours)> hoursByWorker
)
    {
        // 1) Total tips
        var A = A_TotalTips;

        // 2) remove (taxes)% 
        var afterTax = A * (1m - config.TaxPercentB / 100m);

        // 3) remove C% to managers pool
        var ruleByRole = (config.Rules ?? Array.Empty<RoleRule>())
            .ToImmutableDictionary(r => r.Role, StringComparer.OrdinalIgnoreCase);

        // NEW: compute C dynamically if a policy is present; fall back to fixed percent otherwise
        var managersPool = config.ManagersCutPolicy is not null
            ? config.ManagersCutPolicy.Compute(afterTax, hoursByWorker, ruleByRole)
            : afterTax * (config.ManagersPercentC / 100m);

        var staffPool = afterTax - managersPool;

        // Partition workers into groups
        bool IsManager(string? role) =>
            role is not null && ruleByRole.TryGetValue(role, out var rr) && rr.IsManager;

        bool IsEligibleStaff(string? role) =>
            role is not null &&
            ruleByRole.TryGetValue(role, out var rr) &&
            rr.EligibleForTips &&
            !rr.IsManager &&
            !rr.FixedHourlyOnly;

        bool IsFixedOnly(string? role) =>
            role is not null &&
            ruleByRole.TryGetValue(role, out var rr) &&
            rr.FixedHourlyOnly;

        decimal GetGuaranteedHourly(string? role) =>
            role is not null && ruleByRole.TryGetValue(role, out var rr) && rr.GuaranteedHourly is not null
                ? rr.GuaranteedHourly.Value
                : 0m;

        var staffHours = hoursByWorker.Where(w => IsEligibleStaff(w.Role)).Sum(w => w.Hours);
        var managerHours = hoursByWorker.Where(w => IsManager(w.Role)).Sum(w => w.Hours);

        // 6) compute hourly rates
        var staffHourly = staffHours > 0 ? staffPool / staffHours : 0m;
        var managersHourly = managerHours > 0 ? managersPool / managerHours : 0m;

        // 7) per-worker payouts
        var staffRows = new List<TipRow>();
        var managerRows = new List<TipRow>();
        decimal topUpTotal = 0m;

        foreach (var w in hoursByWorker)
        {
            if (w.Hours <= 0) continue;

            // Managers pool
            if (IsManager(w.Role))
            {
                var tip = Math.Round(w.Hours * managersHourly, 2, MidpointRounding.AwayFromZero);
                managerRows.Add(new TipRow(
                    w.WorkerId, w.Name, w.Role, w.Hours,
                    managersHourly, tip, 0m, tip));
                continue;
            }

            // Staff eligible for tips (group D)
            if (IsEligibleStaff(w.Role))
            {
                var baseTip = Math.Round(w.Hours * staffHourly, 2, MidpointRounding.AwayFromZero);

                // Wage floor (guaranteed hourly): establishment pays the difference if pool rate is lower
                var guaranteed = GetGuaranteedHourly(w.Role);
                decimal topUp = 0m;
                if (guaranteed > 0m && staffHourly < guaranteed)
                {
                    topUp = Math.Round((guaranteed - staffHourly) * w.Hours, 2, MidpointRounding.AwayFromZero);
                    topUpTotal += topUp;
                }

                var total = baseTip + topUp;
                staffRows.Add(new TipRow(
                    w.WorkerId, w.Name, w.Role, w.Hours,
                    staffHourly, baseTip, topUp, total));
                continue;
            }

            // Fixed-hourly-only roles: no tips; tracked as zero here (you can handle their fixed pay in payroll, not from tips)
            if (IsFixedOnly(w.Role))
            {
                staffRows.Add(new TipRow(
                    w.WorkerId, w.Name, w.Role, w.Hours,
                    0m, 0m, 0m, 0m));
            }
            // else: silently excluded (no tips eligibility and not fixed-only, so zero row)
        }

        var summary = new TipComputationSummary(
            A_TotalTips: Math.Round(A, 2),
            AfterTax: Math.Round(afterTax, 2),
            StaffPool: Math.Round(staffPool, 2),
            ManagersPool: Math.Round(managersPool, 2),
            StaffHourlyRate: Math.Round(staffHourly, 4),
            ManagersHourlyRate: Math.Round(managersHourly, 4),
            EstablishmentTopUpTotal: Math.Round(topUpTotal, 2)
        );

        return (summary, staffRows, managerRows);
    }
}
