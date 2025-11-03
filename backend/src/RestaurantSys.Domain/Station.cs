using System;
using System.Collections.Generic;
using System.Linq;

namespace RestaurantSys.Domain;

public enum StationType { Service, Back }

public abstract class Station
{
    public Guid Id { get; } = Guid.NewGuid();
    public string Name { get; }
    public StationType Type { get; }
    protected Station(string name, StationType type)
    {
        Name = name.Trim();
        Type = type;
    }
    public override string ToString() => $"{Name} ({Type})";
}

public sealed class ServiceStation : Station
{
    private readonly List<Table> _tables = new();

    public ServiceStation(string name) : base(name, StationType.Service) { }

    // Auto-create tables T1..T{tableCount}
    public ServiceStation(string name, int tableCount) : base(name, StationType.Service)
    {
        if (tableCount <= 0) throw new ArgumentOutOfRangeException(nameof(tableCount));
        for (int n = 1; n <= tableCount; n++)
            _tables.Add(new Table(Guid.NewGuid(), n));
    }

    // Inject an existing set of tables
    public ServiceStation(string name, IEnumerable<Table> tables) : base(name, StationType.Service)
    {
        if (tables is null) throw new ArgumentNullException(nameof(tables));
        _tables.AddRange(tables);
    }

    // <-- This is what your call sites expect
    public IReadOnlyList<Table> Tables => _tables;



    public Table GetTable(int tableNumber) =>
        _tables.First(t => t.TableNumber == tableNumber);

    public Table AddTable(int tableNumber)
    {
        if (_tables.Any(t => t.TableNumber == tableNumber))
            throw new InvalidOperationException($"Table {tableNumber} already exists.");
        var t = new Table(Guid.NewGuid(), tableNumber);
        _tables.Add(t);
        return t;
    }

    public bool RemoveTable(int tableNumber)
    {
        var idx = _tables.FindIndex(t => t.TableNumber == tableNumber);
        if (idx < 0) return false;
        _tables.RemoveAt(idx);
        return true;
    }

    public void OpenTable(int tableNumber, string? notes = null, string? phone = null, decimal? minimum = null)
    {
        var t = GetTable(tableNumber);
        t.Start = DateTime.UtcNow;
        t.End = null;
        if (notes != null) t.Notes = notes;
        if (phone != null) t.PhoneNumber = phone;
        if (minimum.HasValue) t.MinimumForTable = minimum.Value;
    }

    public void CloseTable(int tableNumber)
    {
        var t = GetTable(tableNumber);
        t.End = DateTime.UtcNow;
    }

    public void ReplaceTables(IEnumerable<Table> tables)
    {
        _tables.Clear();
        _tables.AddRange(tables ?? Enumerable.Empty<Table>());
    }

    public void ReplaceTables(IEnumerable<(Guid TableId, int TableNumber)> pairs)
    {
        _tables.Clear();
        _tables.AddRange((pairs ?? Enumerable.Empty<(Guid, int)>())
            .Select(p => new Table(p.TableId, p.TableNumber)));
    }

    public void AddProduct(int tableNumber, string productName, int quantity, decimal unitPrice)
    {
        var t = GetTable(tableNumber);
        t.Products.Add(new TableLine(productName, quantity, unitPrice));
        t.AmountToPay += quantity * unitPrice;
    }

    public void ApplyPayment(int tableNumber, decimal amount)
    {
        var t = GetTable(tableNumber);
        t.AmountPaid += amount;
    }

    public void ApplyDiscount(int tableNumber, decimal discountAmount)
    {
        var t = GetTable(tableNumber);
        t.AppliedDiscount += discountAmount;
    }
}

public sealed class KitchenStation : Station
{
    public KitchenStation(string name) : base(name, StationType.Back) { }
}
