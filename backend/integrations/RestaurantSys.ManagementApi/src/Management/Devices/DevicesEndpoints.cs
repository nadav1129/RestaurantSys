using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class DevicesEndpoints
{
    public static void MapDevicesEndpoints(this WebApplication app)
    {
        var jsonOptionsCamel = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        app.MapGet("/api/printers", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select printer_id, printer_name
                    from printers
                    order by printer_name;
                ";

                var printers = new List<PrinterDto>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    printers.Add(new PrinterDto
                    {
                        PrinterId = reader.GetGuid(0),
                        PrinterName = reader.GetString(1)
                    });
                }

                return Results.Json(printers, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/printers:\n" + ex);
                return Results.Problem($"GET /api/printers failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapPost("/api/printers", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<CreatePrinterRequest>();
                if (body is null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                var printerName = (body.PrinterName ?? string.Empty).Trim();
                if (printerName.Length == 0)
                    return Results.BadRequest(new { error = "PrinterName is required." });

                const string sql = @"
                    insert into printers (printer_name)
                    values (@name)
                    returning printer_id, printer_name;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("name", printerName);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                    return Results.Problem("Failed to insert printer.", statusCode: 500);

                return Results.Json(new PrinterDto
                {
                    PrinterId = reader.GetGuid(0),
                    PrinterName = reader.GetString(1)
                }, jsonOptionsCamel);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { error = "Printer name already exists." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/printers:\n" + ex);
                return Results.Problem($"POST /api/printers failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapDelete("/api/printers/{printerId:guid}", async (Guid printerId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    delete from printers
                    where printer_id = @printer_id;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("printer_id", printerId);

                var affected = await cmd.ExecuteNonQueryAsync();
                return affected == 0
                    ? Results.NotFound(new { error = "Printer not found." })
                    : Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/printers/{printerId}:\n" + ex);
                return Results.Problem($"DELETE /api/printers/{printerId} failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapGet("/api/device-groups", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select
                        g.device_group_id,
                        g.name,
                        g.station_id,
                        s.station_name,
                        s.station_type,
                        count(d.device_id)::int as device_count
                    from device_groups g
                    left join stations s
                      on s.station_id = g.station_id
                    left join devices d
                      on d.device_group_id = g.device_group_id
                    group by g.device_group_id, g.name, g.station_id, s.station_name, s.station_type
                    order by g.name;
                ";

                var groups = new List<DeviceGroupDto>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    groups.Add(new DeviceGroupDto
                    {
                        DeviceGroupId = reader.GetGuid(0),
                        Name = reader.GetString(1),
                        StationId = reader.IsDBNull(2) ? null : reader.GetGuid(2),
                        StationName = reader.IsDBNull(3) ? null : reader.GetString(3),
                        StationType = reader.IsDBNull(4) ? null : reader.GetString(4),
                        DeviceCount = reader.GetInt32(5)
                    });
                }

                return Results.Json(groups, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/device-groups:\n" + ex);
                return Results.Problem($"GET /api/device-groups failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapPost("/api/device-groups", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<CreateDeviceGroupRequest>();
                if (body is null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                var name = (body.Name ?? string.Empty).Trim();
                if (name.Length == 0)
                    return Results.BadRequest(new { error = "Name is required." });

                if (body.StationId.HasValue && !await StationExistsAsync(db, body.StationId.Value))
                    return Results.BadRequest(new { error = "Station not found." });

                const string sql = @"
                    insert into device_groups (name, station_id)
                    values (@name, @station_id)
                    returning device_group_id;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("name", name);
                cmd.Parameters.AddWithValue("station_id", (object?)body.StationId ?? DBNull.Value);

                var groupId = (Guid?)await cmd.ExecuteScalarAsync();
                if (!groupId.HasValue)
                    return Results.Problem("Failed to insert device group.", statusCode: 500);

                var dto = await GetDeviceGroupByIdAsync(db, groupId.Value);
                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { error = "Device group name already exists." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/device-groups:\n" + ex);
                return Results.Problem($"POST /api/device-groups failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapPut("/api/device-groups/{groupId:guid}", async (Guid groupId, UpdateDeviceGroupRequest body, NpgsqlDataSource db) =>
        {
            try
            {
                var name = (body.Name ?? string.Empty).Trim();
                if (name.Length == 0)
                    return Results.BadRequest(new { error = "Name is required." });

                if (body.StationId.HasValue && !await StationExistsAsync(db, body.StationId.Value))
                    return Results.BadRequest(new { error = "Station not found." });

                const string sql = @"
                    update device_groups
                    set
                        name = @name,
                        station_id = @station_id
                    where device_group_id = @group_id;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("group_id", groupId);
                cmd.Parameters.AddWithValue("name", name);
                cmd.Parameters.AddWithValue("station_id", (object?)body.StationId ?? DBNull.Value);

                var affected = await cmd.ExecuteNonQueryAsync();
                if (affected == 0)
                    return Results.NotFound(new { error = "Device group not found." });

                var dto = await GetDeviceGroupByIdAsync(db, groupId);
                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { error = "Device group name already exists." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PUT /api/device-groups/{groupId}:\n" + ex);
                return Results.Problem($"PUT /api/device-groups/{groupId} failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapDelete("/api/device-groups/{groupId:guid}", async (Guid groupId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    delete from device_groups
                    where device_group_id = @group_id;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("group_id", groupId);

                var affected = await cmd.ExecuteNonQueryAsync();
                return affected == 0
                    ? Results.NotFound(new { error = "Device group not found." })
                    : Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/device-groups/{groupId}:\n" + ex);
                return Results.Problem($"DELETE /api/device-groups/{groupId} failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapGet("/api/devices", async (NpgsqlDataSource db) =>
        {
            try
            {
                var devices = await ListDevicesAsync(db);
                return Results.Json(devices, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/devices:\n" + ex);
                return Results.Problem($"GET /api/devices failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapPost("/api/devices", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<CreateDeviceRequest>();
                if (body is null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                var deviceName = (body.DeviceName ?? string.Empty).Trim();
                if (deviceName.Length == 0)
                    return Results.BadRequest(new { error = "DeviceName is required." });

                if (body.PrinterId.HasValue && !await PrinterExistsAsync(db, body.PrinterId.Value))
                    return Results.BadRequest(new { error = "Printer not found." });

                if (body.DeviceGroupId.HasValue && !await DeviceGroupExistsAsync(db, body.DeviceGroupId.Value))
                    return Results.BadRequest(new { error = "Device group not found." });

                const string sql = @"
                    insert into devices (device_name, printer_id, device_group_id)
                    values (@name, @printer_id, @group_id)
                    returning device_id;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("name", deviceName);
                cmd.Parameters.AddWithValue("printer_id", (object?)body.PrinterId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("group_id", (object?)body.DeviceGroupId ?? DBNull.Value);

                var deviceId = (Guid?)await cmd.ExecuteScalarAsync();
                if (!deviceId.HasValue)
                    return Results.Problem("Failed to insert device.", statusCode: 500);

                var dto = await GetDeviceByIdAsync(db, deviceId.Value);
                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { error = "Device name already exists." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/devices:\n" + ex);
                return Results.Problem($"POST /api/devices failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapPut("/api/devices/{deviceId:guid}", async (Guid deviceId, UpdateDeviceRequest body, NpgsqlDataSource db) =>
        {
            try
            {
                var deviceName = (body.DeviceName ?? string.Empty).Trim();
                if (deviceName.Length == 0)
                    return Results.BadRequest(new { error = "DeviceName is required." });

                if (body.PrinterId.HasValue && !await PrinterExistsAsync(db, body.PrinterId.Value))
                    return Results.BadRequest(new { error = "Printer not found." });

                if (body.DeviceGroupId.HasValue && !await DeviceGroupExistsAsync(db, body.DeviceGroupId.Value))
                    return Results.BadRequest(new { error = "Device group not found." });

                const string sql = @"
                    update devices
                    set
                        device_name = @name,
                        printer_id = @printer_id,
                        device_group_id = @group_id
                    where device_id = @device_id;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("device_id", deviceId);
                cmd.Parameters.AddWithValue("name", deviceName);
                cmd.Parameters.AddWithValue("printer_id", (object?)body.PrinterId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("group_id", (object?)body.DeviceGroupId ?? DBNull.Value);

                var affected = await cmd.ExecuteNonQueryAsync();
                if (affected == 0)
                    return Results.NotFound(new { error = "Device not found." });

                var dto = await GetDeviceByIdAsync(db, deviceId);
                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { error = "Device name already exists." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PUT /api/devices/{deviceId}:\n" + ex);
                return Results.Problem($"PUT /api/devices/{deviceId} failed: {ex.Message}", statusCode: 500);
            }
        });

        app.MapDelete("/api/devices/{deviceId:guid}", async (Guid deviceId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    delete from devices
                    where device_id = @device_id;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("device_id", deviceId);

                var affected = await cmd.ExecuteNonQueryAsync();
                return affected == 0
                    ? Results.NotFound(new { error = "Device not found." })
                    : Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/devices/{deviceId}:\n" + ex);
                return Results.Problem($"DELETE /api/devices/{deviceId} failed: {ex.Message}", statusCode: 500);
            }
        });
    }

    private static async Task<List<DeviceDto>> ListDevicesAsync(NpgsqlDataSource db)
    {
        const string sql = @"
            select
                d.device_id,
                d.device_name,
                p.printer_id,
                p.printer_name,
                g.device_group_id,
                g.name,
                s.station_id,
                s.station_name,
                s.station_type
            from devices d
            left join printers p
              on p.printer_id = d.printer_id
            left join device_groups g
              on g.device_group_id = d.device_group_id
            left join stations s
              on s.station_id = g.station_id
            order by d.device_name;
        ";

        var devices = new List<DeviceDto>();

        await using var cmd = db.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            devices.Add(new DeviceDto
            {
                DeviceId = reader.GetGuid(0),
                DeviceName = reader.GetString(1),
                PrinterId = reader.IsDBNull(2) ? null : reader.GetGuid(2),
                PrinterName = reader.IsDBNull(3) ? null : reader.GetString(3),
                DeviceGroupId = reader.IsDBNull(4) ? null : reader.GetGuid(4),
                DeviceGroupName = reader.IsDBNull(5) ? null : reader.GetString(5),
                StationId = reader.IsDBNull(6) ? null : reader.GetGuid(6),
                StationName = reader.IsDBNull(7) ? null : reader.GetString(7),
                StationType = reader.IsDBNull(8) ? null : reader.GetString(8)
            });
        }

        return devices;
    }

    private static async Task<DeviceDto?> GetDeviceByIdAsync(NpgsqlDataSource db, Guid deviceId)
    {
        var devices = await ListDevicesAsync(db);
        return devices.FirstOrDefault(device => device.DeviceId == deviceId);
    }

    private static async Task<DeviceGroupDto?> GetDeviceGroupByIdAsync(NpgsqlDataSource db, Guid groupId)
    {
        const string sql = @"
            select
                g.device_group_id,
                g.name,
                g.station_id,
                s.station_name,
                s.station_type,
                count(d.device_id)::int as device_count
            from device_groups g
            left join stations s
              on s.station_id = g.station_id
            left join devices d
              on d.device_group_id = g.device_group_id
            where g.device_group_id = @group_id
            group by g.device_group_id, g.name, g.station_id, s.station_name, s.station_type;
        ";

        await using var cmd = db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("group_id", groupId);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            return null;

        return new DeviceGroupDto
        {
            DeviceGroupId = reader.GetGuid(0),
            Name = reader.GetString(1),
            StationId = reader.IsDBNull(2) ? null : reader.GetGuid(2),
            StationName = reader.IsDBNull(3) ? null : reader.GetString(3),
            StationType = reader.IsDBNull(4) ? null : reader.GetString(4),
            DeviceCount = reader.GetInt32(5)
        };
    }

    private static async Task<bool> StationExistsAsync(NpgsqlDataSource db, Guid stationId)
    {
        const string sql = "select 1 from stations where station_id = @station_id;";
        await using var cmd = db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("station_id", stationId);
        return await cmd.ExecuteScalarAsync() is not null;
    }

    private static async Task<bool> PrinterExistsAsync(NpgsqlDataSource db, Guid printerId)
    {
        const string sql = "select 1 from printers where printer_id = @printer_id;";
        await using var cmd = db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("printer_id", printerId);
        return await cmd.ExecuteScalarAsync() is not null;
    }

    private static async Task<bool> DeviceGroupExistsAsync(NpgsqlDataSource db, Guid deviceGroupId)
    {
        const string sql = "select 1 from device_groups where device_group_id = @group_id;";
        await using var cmd = db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("group_id", deviceGroupId);
        return await cmd.ExecuteScalarAsync() is not null;
    }
}
