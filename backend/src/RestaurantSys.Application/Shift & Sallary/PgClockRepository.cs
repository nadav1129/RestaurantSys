// File: PgClockRepository.cs
using Npgsql;
using RestaurantSys.Domain;
using System;
using System.Collections.Generic;
using System.Linq;

namespace RestaurantSys.Application
{
    /*--------------------------------------------------------------------
    Class: PgClockRepository
    Purpose: IClockRepository impl that reads/writes from 'shift_events'
             (id uuid, worker_id uuid, kind text 'start'|'end', at timestamptz).
    Notes:
      - Adjust property names on Shift (Start/End) if yours differ
        (e.g., StartUtc/EndUtc). This class assumes:
          Guid   Shift.WorkerId
          DateTime Shift.Start   (UTC)
          DateTime? Shift.End    (UTC, nullable)
    --------------------------------------------------------------------*/
    public sealed class PgClockRepository : IClockRepository
    {
        private readonly NpgsqlDataSource _db;
        public PgClockRepository(NpgsqlDataSource db) => _db = db;

        /* Insert both start and (optional) end as two rows in shift_events. */
        public void AddShift(Shift s)
        {
            using var conn = _db.OpenConnection();
            using var tx = conn.BeginTransaction();

            // start
            using (var cmd = new NpgsqlCommand("""
                insert into shift_events(id, worker_id, kind, at)
                values ($1, $2, 'start', $3)
                """, conn, tx))
            {
                cmd.Parameters.AddWithValue(Guid.NewGuid());
                cmd.Parameters.AddWithValue(s.WorkerId);
                cmd.Parameters.AddWithValue(ToUtc(s.Start));
                cmd.ExecuteNonQuery();
            }

            // end (if present)
            if (s.End is DateTime endUtc)
            {
                using var cmd2 = new NpgsqlCommand("""
                    insert into shift_events(id, worker_id, kind, at)
                    values ($1, $2, 'end', $3)
                    """, conn, tx);
                cmd2.Parameters.AddWithValue(Guid.NewGuid());
                cmd2.Parameters.AddWithValue(s.WorkerId);
                cmd2.Parameters.AddWithValue(ToUtc(endUtc));
                cmd2.ExecuteNonQuery();
            }

            tx.Commit();
        }

        /* Return the currently-open shift for a worker, if any:
           The most-recent 'start' that has no subsequent 'end'. */
        public Shift? GetOpenShift(Guid workerId)
        {
            using var conn = _db.OpenConnection();

            // get last start
            DateTime? lastStart = null;
            using (var cmd = new NpgsqlCommand("""
                select at
                  from shift_events
                 where worker_id = $1 and kind = 'start'
                 order by at desc
                 limit 1
                """, conn))
            {
                cmd.Parameters.AddWithValue(workerId);
                var obj = cmd.ExecuteScalar();
                if (obj is DateTime dt) lastStart = dt;
            }
            if (lastStart is null) return null;

            // is there an 'end' after that start?
            bool closed;
            using (var cmd = new NpgsqlCommand("""
                select exists (
                    select 1
                      from shift_events
                     where worker_id = $1 and kind = 'end' and at >= $2
                )
                """, conn))
            {
                cmd.Parameters.AddWithValue(workerId);
                cmd.Parameters.AddWithValue(lastStart.Value);
                closed = (bool)cmd.ExecuteScalar()!;
            }

            if (closed) return null;

            // open shift with no end
            return NewShift(workerId, lastStart.Value, null);
        }

        /* List all (start,end) pairs for the given day (UTC).
           Pairs are formed by matching each start with the next end.
           A trailing unmatched start produces a shift with End = null. */
        public IEnumerable<Shift> GetShifts(DateOnly day)
        {
            var startUtc = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var endUtc = day.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

            using var conn = _db.OpenConnection();
            using var cmd = new NpgsqlCommand("""
                select worker_id, kind, at
                  from shift_events
                 where at >= $1 and at < $2
                 order by worker_id, at
                """, conn);
            cmd.Parameters.AddWithValue(startUtc);
            cmd.Parameters.AddWithValue(endUtc);

            var rows = new List<(Guid workerId, string kind, DateTime at)>();
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    rows.Add((r.GetGuid(0), r.GetString(1), r.GetDateTime(2)));
                }
            }

            // group-per-worker and pair starts->ends
            var result = new List<Shift>();
            foreach (var grp in rows.GroupBy(x => x.workerId))
            {
                DateTime? openStart = null;
                foreach (var ev in grp)
                {
                    if (ev.kind == "start")
                    {
                        // if already open, finalize previous as open-ended
                        if (openStart is not null)
                            result.Add(NewShift(grp.Key, openStart.Value, null));
                        openStart = ev.at;
                    }
                    else if (ev.kind == "end")
                    {
                        if (openStart is not null)
                        {
                            result.Add(NewShift(grp.Key, openStart.Value, ev.at));
                            openStart = null;
                        }
                        // else stray 'end' — ignore gracefully
                    }
                }
                if (openStart is not null)
                    result.Add(NewShift(grp.Key, openStart.Value, null));
            }

            return result;
        }

        /* --- helpers --- */
        private static DateTime ToUtc(DateTime dt)
            => dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);

        // Adjust construction to your Shift type (object initializer vs ctor)
        private static Shift NewShift(Guid workerId, DateTime startUtc, DateTime? endUtc)
        {
            // If your Shift is a record/ctor: return new Shift(workerId, startUtc, endUtc);
            // If it uses init/setters:
            return new Shift
            (
                workerId,
                startUtc,
                endUtc
            );
        }
    }
}
