using System;

namespace RestaurantSys.Domain;

/*--------------------------------------------------------------------
Class: DailyTotals
Purpose: Tracks the day’s aggregate financial totals:
         A = total order value, B = total payments received.
         Computes Tips = A - B for that date.
--------------------------------------------------------------------*/

public sealed class DailyTotals
{
    public DateOnly Day { get; }
    public decimal OrdersTotalA { get; private set; }   // Sum of order line totals opened today
    public decimal PaymentsTotalB { get; private set; } // Sum of payments received today

    public DailyTotals(DateOnly day) => Day = day;

    public void AddOrderAmount(decimal amount) => OrdersTotalA += amount;
    public void AddPaymentAmount(decimal amount) => PaymentsTotalB += amount;

    public decimal Tips => OrdersTotalA - PaymentsTotalB;
}
