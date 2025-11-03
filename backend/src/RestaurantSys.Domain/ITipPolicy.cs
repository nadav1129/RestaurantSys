// File: ITipPolicy.cs
using System;
using System.Collections.Generic;

namespace RestaurantSys.Domain;

/*--------------------------------------------------------------------
Record: TipRow
Purpose: Represents a single worker’s row in a tip payout table,
         including hours, hourly rate used, tip pay, top-up, and total pay.
--------------------------------------------------------------------*/
public sealed record TipRow(
    Guid WorkerId,
    string WorkerName,
    string? Role,
    decimal Hours,
    decimal HourlyRateApplied,   /* the pool’s hourly rate used for this row (staff or managers) */
    decimal TipPay,              /* hours * hourly rate from pool */
    decimal EstablishmentTopUp,  /* extra to meet guaranteed hourly if applicable (staff only) */
    decimal TotalPay             /* TipPay + EstablishmentTopUp */
);


/*--------------------------------------------------------------------
Record: TipComputationSummary
Purpose: Summarizes results of the tip computation:
         total A, after-tax pool, staff/managers pool sizes,
         computed hourly rates, and total top-ups.
--------------------------------------------------------------------*/
public sealed record TipComputationSummary(
    decimal A_TotalTips,
    decimal AfterTax,          /* A * (1 - B) */
    decimal StaffPool,         /* AfterTax - ManagersPool */
    decimal ManagersPool,
    decimal StaffHourlyRate,   /* StaffPool / Σhours(EligableForTips) or 0 */
    decimal ManagersHourlyRate,/* ManagersPool / Σmanager hours or 0 */
    decimal EstablishmentTopUpTotal
);


/*--------------------------------------------------------------------
Interface: ITipPolicy
Purpose: General strategy interface for computing staff and manager
         tip payouts based on configuration, hours, and total tips (A).
--------------------------------------------------------------------*/
public interface ITipPolicy
{
    (TipComputationSummary Summary,
     IReadOnlyList<TipRow> StaffRows,
     IReadOnlyList<TipRow> ManagerRows)
    Compute(
        TipFormulaConfig config,
        decimal A_TotalTips,
        IReadOnlyList<(Guid WorkerId, string Name, string? Role, decimal Hours)> hoursByWorker
    );
}
