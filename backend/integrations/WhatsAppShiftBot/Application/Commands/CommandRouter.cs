using Npgsql;
using RestaurantSys.Application;            // DaySimulation
using RestaurantSys.Application.Payroll;   // TipExcelExporter
using RestaurantSys.Domain;
using System.IO;
using WhatsAppWebhook.Application.Nlu;
using RestaurantSys.Application.Simulation;

public sealed class CommandRouter
{
    private readonly NpgsqlDataSource _db;
    private readonly TipFormulaConfig _tipConfig;
    private readonly string _publicBaseUrl; // e.g. https://<your-tunnel>.trycloudflare.com

    public CommandRouter(NpgsqlDataSource db, TipFormulaConfig tipConfig, string publicBaseUrl)
    {
        _db = db;
        _tipConfig = tipConfig;
        _publicBaseUrl = publicBaseUrl.TrimEnd('/');
    }

    public async Task<string> HandleAsync(string fromE164, string body, NluResult nlu, CancellationToken ct = default)
    {
        switch (nlu.Intent)
        {
            // keep your existing AddWorker / StartShift / EndShift cases here…

            case Intent.RunDaySim:
                {
                    if (!await IsAdminAsync(fromE164, ct))
                        return "Only admins can run the day simulation.";

                    var workers = await LoadWorkersAsync(ct);   // from DB; default role
                    var result = DaySimulation.Run(_db, _tipConfig, workers);

                    // ensure wwwroot/reports exists
                    var root = Path.Combine(AppContext.BaseDirectory, "wwwroot", "reports");
                    Directory.CreateDirectory(root);

                    var file = $"tips-{DateTime.UtcNow:yyyyMMdd-HHmm}.xlsx";
                    var path = Path.Combine(root, file);
                    TipExcelExporter.Export(result, path);

                    var url = $"{_publicBaseUrl}/reports/{file}";
                    var summary =
                        $"Tips (A): {result.Summary.A_TotalTips}\n" +
                        $"After tax: {result.Summary.AfterTax}\n" +
                        $"Staff pool: {result.Summary.StaffPool}\n" +
                        $"Managers: {result.Summary.ManagersPool}";

                    return $"✅ Simulation completed.\n{summary}\n\nDownload: {url}";
                }
        }

        return "Commands: start <name> [at HH:MM] | end <name> [at HH:MM] | add worker <name> | run day sim";
    }

    private async Task<bool> IsAdminAsync(string fromE164, CancellationToken ct)
    {
        await using var cmd = _db.CreateCommand("select is_admin from workers where phone_e164=$1");
        cmd.Parameters.AddWithValue(fromE164);
        var obj = await cmd.ExecuteScalarAsync(ct);
        return obj is bool b && b;
    }

    private async Task<IReadOnlyDictionary<Guid, Worker>> LoadWorkersAsync(CancellationToken ct)
    {
        var dict = new Dictionary<Guid, Worker>();
        await using var cmd = _db.CreateCommand("select worker_id, full_name from workers order by full_name");
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            var id = r.GetGuid(0);
            var name = r.GetString(1);
            // TODO: if you add a 'role' column in workers, read it here.
            dict[id] = new Worker(id, name, role: "Waiter");
        }
        return dict;
    }
}
