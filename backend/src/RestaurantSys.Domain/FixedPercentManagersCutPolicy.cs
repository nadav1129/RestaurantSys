// File: FixedPercentManagersCutPolicy.cs  (NEW)
using System;
using System.Collections.Generic;

namespace RestaurantSys.Domain;

/*--------------------------------------------------------------------
Class: FixedPercentManagersCutPolicy
Purpose: Basic implementation of IManagersCutPolicy.
         Always returns afterTax * (fixedPercent / 100).
--------------------------------------------------------------------*/
public sealed class FixedPercentManagersCutPolicy : IManagersCutPolicy
{
    private readonly decimal _percent;
    public FixedPercentManagersCutPolicy(decimal percent) => _percent = percent;

    public decimal Compute(
        decimal afterTax,
        IReadOnlyList<(Guid WorkerId, string Name, string? Role, decimal Hours)> hoursByWorker,
        IReadOnlyDictionary<string, RoleRule> rules)
        => afterTax * (_percent / 100m);
}
