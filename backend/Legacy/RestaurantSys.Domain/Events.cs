namespace RestaurantSys.Domain;

public sealed class LowStockEvent
{
    public Station Station { get; }
    public string SkuLabel { get; }
    public int FullBottles { get; }
    public decimal OpenMl { get; }
    public int ThresholdBottles { get; }

    public LowStockEvent(Station station, string skuLabel, int fullBottles, decimal openMl, int thresholdBottles)
    {
        Station = station;
        SkuLabel = skuLabel;
        FullBottles = fullBottles;
        OpenMl = openMl;
        ThresholdBottles = thresholdBottles;
    }

    public override string ToString()
        => $"LOW STOCK @ {Station.Name}: {SkuLabel} -> {FullBottles} bottles (+{OpenMl} ml open) (≤ {ThresholdBottles} bottles).";
}
