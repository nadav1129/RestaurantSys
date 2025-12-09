using System;
using System.Collections.Generic;

namespace RestaurantSys.Domain;
/*--------------------------------------------------------------------
Interface: IManagersCutPolicy
Purpose: Strategy interface for dynamic computation of managers’ cut (C%).
         Implementations may decide C based on hours, number of managers,
         or other business-specific logic.
--------------------------------------------------------------------*/

public interface IManagersCutPolicy
{
    /// <summary>
    /// Return the managers' cut (absolute currency amount) out of 'afterTax'.
    /// You may use roles/hours to compute any dynamic scheme.
    /// </summary>
    decimal Compute(
        decimal afterTax,
        IReadOnlyList<(Guid WorkerId, string Name, string? Role, decimal Hours)> hoursByWorker,
        IReadOnlyDictionary<string, RoleRule> rules
    );
}
