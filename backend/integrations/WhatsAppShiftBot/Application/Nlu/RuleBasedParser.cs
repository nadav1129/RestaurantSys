using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace WhatsAppWebhook.Application.Nlu
{
    public sealed class RuleBasedParser : IIntentParser
    {
        /* Only what we use now */
        private static readonly Regex AddWorkerR = new(
            @"^\s*(?:add\s+(?:new\s+)?worker|worker\s+add)\s+(?<name>.+?)\s*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex StartR = new(
            @"^\s*start(?:\s*shift)?(?:\s+(?<name>[^@,]+?))?(?:\s*(?:at|@)\s*(?<time>\d{1,2}:\d{2}))?\s*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex EndR = new(
            @"^\s*end(?:\s*shift)?(?:\s+(?<name>[^@,]+?))?(?:\s*(?:at|@)\s*(?<time>\d{1,2}:\d{2}))?\s*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex RunSimR = new(
            @"^\s*run\s+(?:day\s*)?(?:sim|simulation)\s*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static string CleanName(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return string.Empty;
            return s.Trim().Trim('"', '“', '”', '\'', '‚', '’');
        }

        private static string NormalizeTime(string? t)
        {
            if (string.IsNullOrWhiteSpace(t)) return string.Empty;
            // Keep HH:mm as-is; you can later parse to a DateTime if needed
            return t.Trim();
        }

        public NluResult Parse(string text)
        {
            var raw = (text ?? string.Empty).Trim();
            var ent = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            if (RunSimR.IsMatch(raw))
                return new NluResult(Intent.RunDaySim, ent, raw);

            // 1) add worker
            var mAdd = AddWorkerR.Match(raw);
            if (mAdd.Success)
            {
                var name = CleanName(mAdd.Groups["name"].Value);
                if (!string.IsNullOrEmpty(name)) ent["Name"] = name;
                return new NluResult(Intent.AddWorker, ent, raw);
            }

            // 2) start
            var mStart = StartR.Match(raw);
            if (mStart.Success)
            {
                var name = CleanName(mStart.Groups["name"]?.Value);
                var time = NormalizeTime(mStart.Groups["time"]?.Value);

                if (!string.IsNullOrEmpty(name)) ent["Name"] = name;
                if (!string.IsNullOrEmpty(time)) ent["Time"] = time;

                return new NluResult(Intent.StartShift, ent, raw);
            }

            // 3) end
            var mEnd = EndR.Match(raw);
            if (mEnd.Success)
            {
                var name = CleanName(mEnd.Groups["name"]?.Value);
                var time = NormalizeTime(mEnd.Groups["time"]?.Value);

                if (!string.IsNullOrEmpty(name)) ent["Name"] = name;
                if (!string.IsNullOrEmpty(time)) ent["Time"] = time;

                return new NluResult(Intent.EndShift, ent, raw);
            }

            // 4) unknown
            return new NluResult(Intent.Unknown, ent, raw);
        }
    }
}
