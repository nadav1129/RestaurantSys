public record CreateStationRequest(int Num, string Name);
public record StationDto(Guid StationId, int Num, string Name);

public record CreateTableRequest(string SerialNum);
public record TableDto(Guid TableId, string SerialNum);

public record ConnectTableRequest(Guid TableId, Guid? StationId, string Name, string? Notes, int? MinimumCents);
public record ActiveTableDto(Guid ActiveTableId, Guid TableId, Guid? StationId, string Name, string? Notes, int? MinimumCents, bool IsOpen);

public record CreateReservationRequest(
    string ReserverName,
    string ReserverPhone,
    int NumberOfGuests,
    int? MinimumCents,
    DateTime DateStart,   // ISO from frontend
    DateTime DateEnd,
    string? Notes,
    bool Vip
);
public record ReservationDto(
    Guid ReservationId, string ReserverName, string ReserverPhone, int NumberOfGuests,
    int? MinimumCents, DateTime DateStart, DateTime DateEnd, string? Notes, bool Vip, string Status
);

public record AssignTableRequest(Guid ActiveTableId);

public record CreateGuestRequest(string Name, Guid? ReservationId, bool Vip);
public record GuestDto(Guid GuestId, string Name, Guid? ReservationId, bool Vip);

public record BlacklistRequest(string Name, string IdNum, string? Notes);
public record BlacklistDto(Guid BlacklistId, string Name, string IdNum, string? Notes);



