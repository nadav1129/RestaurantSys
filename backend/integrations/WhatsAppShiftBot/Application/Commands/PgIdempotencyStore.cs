using System.Threading;
using System.Threading.Tasks;
using Npgsql;

namespace WhatsAppWebhook.Application.Commands
{
    public sealed class PgIdempotencyStore : IIdempotencyStore
    {
        private readonly NpgsqlDataSource _db;
        public PgIdempotencyStore(NpgsqlDataSource db) => _db = db;

        public async Task<bool> TryBeginAsync(string messageId, CancellationToken ct = default)
        {
            await using var cmd = _db.CreateCommand(
                "insert into webhook_receipts(message_id, received_at) values ($1, now()) on conflict do nothing");
            cmd.Parameters.AddWithValue(messageId ?? string.Empty);
            var rows = await cmd.ExecuteNonQueryAsync(ct); // 1=new, 0=duplicate
            return rows > 0;
        }

        // Match the interface signature; nothing to commit because we don't hold a transaction
        public Task EndAsync(CancellationToken ct = default) => Task.CompletedTask;
    }
}
