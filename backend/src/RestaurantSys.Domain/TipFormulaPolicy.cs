using System.Collections.Generic;

namespace RestaurantSys.Domain;

/*--------------------------------------------------------------------
Record: RoleRule
Purpose: Defines how each job type behaves in tip distribution:
         - EligibleForTips: participates in staff pool
         - IsManager: participates in managers pool (C%)
         - FixedHourlyOnly: has no tip dependency
         - GuaranteedHourly: minimum hourly wage for that role
--------------------------------------------------------------------*/

public sealed record RoleRule(
    string Role,
    bool EligibleForTips,
    bool IsManager,
    bool FixedHourlyOnly,
    decimal? GuaranteedHourly
);

/*--------------------------------------------------------------------
Record: TipFormulaConfig
Purpose: Establishment-level configuration for tip formula parameters:
         - TaxPercentB: B% to remove for taxes/government
         - ManagersPercentC: default C% for manager pool
         - Rules: per-role configuration list
         - ManagersCutPolicy: optional dynamic policy to compute C%
--------------------------------------------------------------------*/

public sealed record TipFormulaConfig(
    decimal TaxPercentB,                 /* B% */
    decimal ManagersPercentC,            /* default C% if no policy supplied */
    IReadOnlyList<RoleRule> Rules,
    IManagersCutPolicy? ManagersCutPolicy = null /* NEW: dynamic C */
);
