// File: BigTestScenario.cs

using System;
using System.Collections.Generic;
using System.Linq;
using RestaurantSys.Domain;
using RestaurantSys.Application;

public class InventoryConsumer : IInventoryConsumer
{
    private readonly BottledInventoryService _inv;
    private readonly StationsAndInventorySetup.CatalogAndProducts _cv;

    public InventoryConsumer(BottledInventoryService inv, StationsAndInventorySetup.CatalogAndProducts cv)
    {
        _inv = inv;
        _cv = cv;
    }

    public bool TryConsume(ServiceStation station, string productName, int quantity, Notifications _)
    {
        try
        {
            for (int i = 0; i < quantity; i++)
                ConsumeOnce(station, productName);
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WARN  {DateTime.Now:T}] Inventory consume failed for '{productName}': {ex.Message}");
            return false;
        }
    }

    private void ConsumeOnce(ServiceStation st, string productName)
    {
        // ===== 1) COMBO (special mechanic #1) =====
        if (string.Equals(productName, "Shot + Soft (60ml + 250ml)", StringComparison.OrdinalIgnoreCase))
        {
            // Alcohol 60ml + Soft 250ml. Use Vodka for alcohol, Lemonade for soft (configurable).
            _inv.Pour(st, _cv.Alcohol_Vodka, 60m, OnLow);
            _inv.Pour(st, _cv.Soft_Lemonade, 250m, OnLow);
            return;
        }

        // ===== 2) GENERIC POURS =====
        if (string.Equals(productName, "Alcohol (any) 60ml", StringComparison.OrdinalIgnoreCase))
        {
            _inv.Pour(st, _cv.Alcohol_Vodka, 60m, OnLow); // default family choice: Vodka
            return;
        }
        if (string.Equals(productName, "Alcohol (any) 30ml", StringComparison.OrdinalIgnoreCase))
        {
            _inv.Pour(st, _cv.Alcohol_Vodka, 30m, OnLow);
            return;
        }
        if (string.Equals(productName, "Soft (any) 250ml", StringComparison.OrdinalIgnoreCase))
        {
            _inv.Pour(st, _cv.Soft_Lemonade, 250m, OnLow); // default family choice: Lemonade
            return;
        }

        // ===== 3) PRODUCT-BACKED: try bottle first =====
        var p = _cv.Catalog.FindProduct(productName);
        if (p is null)
            throw new InvalidOperationException($"Unknown product '{productName}' (not in Catalog).");

        if (p.IsBottle)
        {
            _inv.SellWholeBottle(st, p, 1);
            return;
        }

        // ===== 4) PRODUCT-BACKED: cocktail pour by family =====
        // Leading substitution demo (special mechanic #2): if Negroni, swap its "Gin" component to Vodka.
        // In a full system you'd carry tags + a UI choice; here we just demo the mechanism.
        bool leadingSwapToVodka = string.Equals(p.Name, "Negroni", StringComparison.OrdinalIgnoreCase);
        foreach (var c in p.Components)
        {
            var ing = c.Ingredient;

            if (leadingSwapToVodka && string.Equals(ing.Name, "Gin", StringComparison.OrdinalIgnoreCase))
                ing = _cv.Alcohol_Vodka; // swap “leading” gin to vodka for demo

            _inv.Pour(st, ing, c.AmountMl, OnLow);
        }
    }

    private void OnLow(BottledInventoryService.LowStockEvent e)
    {
        Console.WriteLine($"[WARN  {DateTime.Now:T}] LOW @ {e.Station.Name}: {e.Product.Name} — {e.RemainingBottles} bottles left, open {e.OpenMl} ml (≤ {e.ThresholdBottles}).");
    }
}
    

