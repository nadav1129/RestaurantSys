using System;

namespace RestaurantSys.Domain;

public readonly record struct Quantity(decimal Value, UnitType Unit)
{
    public static Quantity Ml(decimal v) => new Quantity(v, UnitType.Milliliter);
    public static Quantity Pc(decimal v) => new Quantity(v, UnitType.Unit);

    public static Quantity operator +(Quantity a, Quantity b)
    {
        if (a.Unit != b.Unit) throw new InvalidOperationException("Unit mismatch.");
        return new Quantity(a.Value + b.Value, a.Unit);
    }
    public static Quantity operator -(Quantity a, Quantity b)
    {
        if (a.Unit != b.Unit) throw new InvalidOperationException("Unit mismatch.");
        return new Quantity(a.Value - b.Value, a.Unit);
    }
    public override string ToString() => $"{Value} {Unit}";
}
