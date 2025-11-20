using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using System.Collections.Generic;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class TableStationsEndpoints
{
    public static void MapTableStationsEndpoints(this WebApplication app)
    {
        var jsonOptionsCamel = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        app.MapGet("/api/stations/{stationId:guid}/tables",
    async (Guid stationId, NpgsqlDataSource db) =>
    {
        const string sql = @"
        select t.table_id, t.table_number
        from station_tables st
        join tables t on t.table_id = st.table_id
        where st.station_id = @station_id
        order by t.table_number;
    ";

        var list = new List<TableDto>();

        await using var cmd = db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("station_id", stationId);

        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            list.Add(new TableDto 
            {
                TableId = reader.GetGuid(0),
                TableNum = reader.GetInt32(1)
            });
        }

        return Results.Json(
            list,
            new System.Text.Json.JsonSerializerOptions
            {
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
            }
        );
    });


        app.MapPost("/api/stations/{stationId:guid}/tables",
    async (Guid stationId, HttpRequest req, NpgsqlDataSource db) =>
    {
        try
        {
            var body = await req.ReadFromJsonAsync<CreateStationTableRequest>();
            if (body is null)
                return Results.BadRequest(new { error = "Invalid JSON." });

            var tableNum = body.TableNum;
            if (tableNum <= 0)
                return Results.BadRequest(new { error = "TableNum must be > 0." });

            await using var conn = await db.OpenConnectionAsync();
            await using var tx = await conn.BeginTransactionAsync();

            /* Make sure station exists */
            const string checkStationSql = "select 1 from stations where station_id = @station_id;";
            await using (var checkCmd = new NpgsqlCommand(checkStationSql, conn, tx))
            {
                checkCmd.Parameters.AddWithValue("station_id", stationId);
                var exists = await checkCmd.ExecuteScalarAsync();
                if (exists is null)
                    return Results.NotFound(new { error = "Station not found." });
            }

            /* Upsert table by number */
            const string upsertTableSql = @"
            insert into tables (table_number)
            values (@table_number)
            on conflict (table_number)
            do update set table_number = excluded.table_number
            returning table_id, table_number;
        ";

            Guid tableId;
            int actualNumber;

            await using (var tableCmd = new NpgsqlCommand(upsertTableSql, conn, tx))
            {
                tableCmd.Parameters.AddWithValue("table_number", tableNum);
                await using var reader = await tableCmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                    return Results.Problem("Failed to create or load table.", statusCode: 500);

                tableId = reader.GetGuid(0);
                actualNumber = reader.GetInt32(1);
            }

            /* Link station <-> table (idempotent) */
            const string linkSql = @"
            insert into station_tables (station_id, table_id)
            values (@station_id, @table_id)
            on conflict (station_id, table_id) do nothing;
        ";

            await using (var linkCmd = new NpgsqlCommand(linkSql, conn, tx))
            {
                linkCmd.Parameters.AddWithValue("station_id", stationId);
                linkCmd.Parameters.AddWithValue("table_id", tableId);
                await linkCmd.ExecuteNonQueryAsync();
            }

            await tx.CommitAsync();

            var dto = new TableDto
            {
                TableId = tableId,
                TableNum = actualNumber
            };

            return Results.Json(
                dto,
                new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
                }
            );
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Error in POST /api/stations/{stationId}/tables:\n" + ex);
            return Results.Problem($"POST /api/stations/{stationId}/tables failed: {ex.Message}", statusCode: 500);
        }
    });


        app.MapDelete("/api/stations/{stationId:guid}/tables/{tableId:guid}",
    async (Guid stationId, Guid tableId, NpgsqlDataSource db) =>
    {
        try
        {
            const string sql = @"
            delete from station_tables
            where station_id = @station_id
              and table_id   = @table_id;
        ";

            await using var cmd = db.CreateCommand(sql);
            cmd.Parameters.AddWithValue("station_id", stationId);
            cmd.Parameters.AddWithValue("table_id", tableId);

            var rows = await cmd.ExecuteNonQueryAsync();
            if (rows == 0)
                return Results.NotFound(new { error = "Relationship not found." });

            return Results.NoContent();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Error in DELETE /api/stations/{stationId}/tables/{tableId}:\n" + ex);
            return Results.Problem($"DELETE /api/stations/{stationId}/tables/{tableId} failed: {ex.Message}", statusCode: 500);
        }
    });



    }
}