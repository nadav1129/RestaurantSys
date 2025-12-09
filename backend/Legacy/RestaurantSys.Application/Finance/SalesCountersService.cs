// File: SalesCountersService.cs
using RestaurantSys.Domain;
using System;

namespace RestaurantSys.Application;

/*--------------------------------------------------------------------
Class: SalesCountersService
Purpose: Tracks A (order total) and B (payment total) events by day.
         Integrates with order and payment flow to feed payroll logic.
--------------------------------------------------------------------*/
public sealed class SalesCountersService
{
    private readonly IDailyTotalsRepository _repo;

    public SalesCountersService(IDailyTotalsRepository repo) => _repo = repo;

    public void OrderOpened(decimal orderTotal, DateTime whenUtc)
    {
        var day = DateOnly.FromDateTime(whenUtc);
        _repo.GetOrCreate(day).AddOrderAmount(orderTotal);
    }

    public void PaymentReceived(decimal amount, DateTime whenUtc)
    {
        var day = DateOnly.FromDateTime(whenUtc);
        _repo.GetOrCreate(day).AddPaymentAmount(amount);
    }

    public DailyTotals GetDaily(DateOnly day) => _repo.GetOrCreate(day);
}
