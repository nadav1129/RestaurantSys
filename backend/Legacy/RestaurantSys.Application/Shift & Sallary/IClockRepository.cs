// File: IClockRepository.cs
using RestaurantSys.Domain;
using System;
using System.Collections.Generic;

namespace RestaurantSys.Application;

/*--------------------------------------------------------------------
Interface: IClockRepository
Purpose: Storage abstraction for shift data. Provides methods
         to add shifts, get open shifts, and list shifts by date.
--------------------------------------------------------------------*/
public interface IClockRepository
{
    void AddShift(Shift s);
    Shift? GetOpenShift(Guid workerId);
    IEnumerable<Shift> GetShifts(DateOnly day);
}
