using RestaurantSys.Domain;
using System;
using System.Collections.Generic;

namespace RestaurantSys.Application;

public interface IDailyTotalsRepository
{
    DailyTotals GetOrCreate(DateOnly day);
}

public sealed class InMemoryDailyTotalsRepository : IDailyTotalsRepository
{
    private readonly Dictionary<DateOnly, DailyTotals> _map = new();

    public DailyTotals GetOrCreate(DateOnly day)
    {
        if (!_map.TryGetValue(day, out var d))
        {
            d = new DailyTotals(day);
            _map[day] = d;
        }
        return d;
    }
}
