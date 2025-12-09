using System;

namespace RestaurantSys.Domain;

/*--------------------------------------------------------------------
Class: Worker
Purpose: Represents an employee in the establishment, identified by ID,
         with a name and optional role (e.g., Waiter, Bartender, Manager).
--------------------------------------------------------------------*/

public sealed class Worker
{
    public Guid WorkerId { get; }
    public string FullName { get; }
    public string? Role { get; }

    public Worker(Guid id, string fullName, string? role = null)
    {
        WorkerId = id;
        FullName = fullName;
        Role = role;
    }
}
