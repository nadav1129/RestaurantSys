using System.Threading;
using System.Threading.Tasks;

namespace WhatsAppWebhook.Application.Commands
{
    public interface IIdempotencyStore
    {
        Task<bool> TryBeginAsync(string messageId, CancellationToken ct = default);
        Task EndAsync(CancellationToken ct = default);
    }
}
