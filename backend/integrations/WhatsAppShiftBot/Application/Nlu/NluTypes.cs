using System.Collections.Generic;

namespace WhatsAppWebhook.Application.Nlu
{
    //Defines the possible inrerpetation of a msg, for each intent there is a matching command 
    public enum Intent
    {
        Unknown = 0,
        StartShift = 1,
        EndShift = 2,
        AddWorker = 3,
        RunDaySim = 4,     
        ExportTips = 5    
    }

    //Structure that warps a raw msg and its interpetation + contain relevant dependent info 
    public sealed class NluResult
    {
        //The final Resault deemed after interpeting
        public Intent Intent { get; }
        //Structured data extracted from that text to help later commands.
        public IReadOnlyDictionary<string, string> Entities { get; }
        //The Raw msg recived from client
        public string Raw { get; }

        public NluResult(Intent intent, IReadOnlyDictionary<string, string> entities, string raw)
        {
            Intent = intent;
            Entities = entities;
            Raw = raw ?? string.Empty;
        }
    }

    //Defines the contract: given raw text, produce an object of type NluResult 
    public interface IIntentParser
    {
        NluResult Parse(string text);
    }
}
