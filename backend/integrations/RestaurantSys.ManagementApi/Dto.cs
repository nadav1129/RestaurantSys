using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace RestaurantSys.Api
{
    /* ============ MENU TYPES ============ */
    public sealed class MenuDto
    {
        public int MenuNum { get; set; }
        public string Name { get; set; } = "";
    }

    public sealed class CreateMenuRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string? Name { get; set; }
    }

    public sealed class UpdateMenuPayload
    {
        public string? Name { get; set; }
    }


    /* ============ MENU TREE ============ */
    public sealed class MenuNodeDto
    {
        public int MenuNum { get; set; }
        public Guid Id { get; set; }
        public Guid? ParentId { get; set; }
        public string Name { get; set; } = "";
        public bool IsLeaf { get; set; }

        // NEW: depth from the implicit root (root=0, top-level=1, etc.)
        public int Layer { get; set; }

        // NEW: order among siblings (computed per ParentId)
        public int SortOrder { get; set; }

        // Optional: if your leaves have prices
        public int? PriceCents { get; set; }

        public List<MenuNodeDto> Children { get; set; } = new();
    }

    public sealed class CreateMenuNodeRequest
    {
        [JsonPropertyName("MenuNum")]
        public int MenuNum { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("isLeaf")]
        public bool IsLeaf { get; set; }

        [JsonPropertyName("priceCents")]
        public int? PriceCents { get; set; }

        [JsonPropertyName("parentId")]
        public Guid? ParentId { get; set; }
    }



    /* ============ PRODUCTS (LIST + CREATE) ============ */
    public sealed class ProductListItemDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = default!;
        public string Type { get; set; } = default!;
        public int? Price { get; set; }   // <- nullable; no price = null
    }


    // Each ingredient component within a product 
    public sealed class CreateProductComponentRequest
    {
        public Guid IngredientId { get; set; }
        public decimal AmountMl { get; set; }         /* parsed from UI amount field */
        public bool IsLeading { get; set; }           /* main ingredient (e.g. gin in gin tonic) */
        public bool IsChangeable { get; set; }        /* can bartender substitute this? */
    }

    /* ============ CREATE PRODUCT REQUEST ============ */
    public sealed class CreateSimpleProductRequest
    {
        public Guid? MenuNodeId { get; set; }
        public string? Type { get; set; }
        public string Name { get; set; } = "";
        public bool SoldAsBottleOnly { get; set; }
        public List<Guid>? MenuNodeIds { get; set; }
        /* may be empty � represents a product without ingredients */
        public List<CreateProductComponentRequest>? Components { get; set; } = new();
    }

    public sealed class LinkProductRequest { public Guid ProductId { get; set; } }

    /* ============ INGREDIENTS (for dropdowns) ============ */
    public sealed class IngredientDto
    {
        [JsonPropertyName("Id")]
        public Guid IngredientId { get; set; }
        [JsonPropertyName("IngredientId")]
        public string Name { get; set; } = "";
    }



    /* ============ SPEED RAIL ============ */
    public sealed class SpeedMapRowDto
    {
        public Guid IngredientId { get; set; }
        public string IngredientName { get; set; } = "";
        public Guid? BottleProductId { get; set; }
        public string? BottleProductName { get; set; }
    }

    public sealed class UpdateSpeedMapRequestRow
    {
        public Guid IngredientId { get; set; }
        public Guid? BottleProductId { get; set; }
    }



    /* ============ PRICES TAB ============ */
    public sealed class UpsertProductPriceRequest
    {
        public Guid ProductId { get; set; }
        public int MenuNum { get; set; }
        public decimal? Price { get; set; }
    }


    /* ============ SETTINGS TAB ============ */
    public sealed class ManagementSettingsDto
    {
        public int? ActiveMenuNum { get; set; }
        public decimal GlobalDiscountPct { get; set; }
    }

    public sealed class UpdateManagementSettingsRequest
    {
        public int? ActiveMenuNum { get; set; }          /* null clears selection */
        public decimal? GlobalDiscountPct { get; set; }   /* optional partial update */
    }

    /* ============ STATIONS ============ */
    public sealed class StationDto
    {
        public Guid StationId { get; init; }
        public string StationName { get; init; } = string.Empty;
        public string StationType { get; init; } = string.Empty;
    }

    public sealed class CreateStationRequest
    {
        public string? StationName { get; set; }
        public string? StationType { get; set; }
    }

    /* ============ Lists ============ */
    public sealed class ListDto
    {
        public Guid ListId { get; init; }
        public string Title { get; init; } = string.Empty;
        public string ListType { get; init; } = string.Empty; // "Tables" | "Names"
    }

    public sealed class CreateListRequest
    {
        public string? Title { get; set; }
        public string? ListType { get; set; } // "Tables" | "Names"
    }

    public sealed class RenameListRequest
    {
        public string? Title { get; set; }
    }

    public sealed class ListEntryDto
    {
        public Guid EntryId { get; init; }
        public Guid ListId { get; init; }

        public string Name { get; init; } = string.Empty;
        public string Phone { get; init; } = string.Empty;
        public string Note { get; init; } = string.Empty;

        public int? NumPeople { get; init; }
        public string? StartTime { get; init; } // "HH:mm"
        public string? EndTime { get; init; }   // "HH:mm"
        public int? Minutes { get; init; }
    }

    /* ============ Tables ============ */
    public sealed class TableDto
    {
        public Guid TableId { get; set; }
        public int TableNum { get; set; }
    }

    public sealed class CreateStationTableRequest
    {
        public int TableNum { get; set; }
    }
    public sealed class UpdateTableRequest
    {
        public int TableNum { get; set; }
    }

    /* ============ User ============ */
    public sealed class UserDto
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = "temp";
        public string Role { get; set; } = "user";

    }

    public sealed class CreateUserRequest
    {
        public Guid WorkerId { get; set; }
        public string? Role { get; set; } = "user";
        public string? Passcode { get; set; }
    }

    public sealed class LoginRequest
    {
        public Guid UserId { get; set; }
        public string Passcode { get; set; } = string.Empty;
    }

    /* ============ Worker ============ */
    public sealed class WorkerDto
    {
        [JsonPropertyName("workerId")]
        public Guid WorkerId { get; set; }

        [JsonPropertyName("firstName")]
        public string FirstName { get; set; } = string.Empty;

        [JsonPropertyName("lastName")]
        public string LastName { get; set; } = string.Empty;

        [JsonPropertyName("personalId")]
        public string? PersonalId { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("phone")]
        public string? Phone { get; set; }

        [JsonPropertyName("position")]
        public string Position { get; set; } = string.Empty;

        [JsonPropertyName("salaryCents")]
        public int? SalaryCents { get; set; }

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }
    }

    public sealed class CreateWorkerRequest
    {
        [JsonPropertyName("firstName")]
        public string? FirstName { get; set; }

        [JsonPropertyName("lastName")]
        public string? LastName { get; set; }

        [JsonPropertyName("position")]
        public string? Position { get; set; }

        [JsonPropertyName("personalId")]
        public string? PersonalId { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("phone")]
        public string? Phone { get; set; }

        [JsonPropertyName("salaryCents")]
        public int? SalaryCents { get; set; }
    }

    public sealed class CreateWorkerResponse
    {
        [JsonPropertyName("worker")]
        public WorkerDto Worker { get; set; } = default!;

        [JsonPropertyName("loginCode")]
        public string LoginCode { get; set; } = string.Empty;
    }

    /* =========================
     * Device
     * ========================= */

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DeviceType
    {
        fixedDevice,   // we’ll serialize as "fixed"
        personalDevice // we’ll serialize as "personal"
    }

    public static class DeviceTypeStrings
    {
        public const string Fixed = "fixed";
        public const string Personal = "personal";
    }

    /* =========================
     * Shift
     * ========================= */

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ShiftStatus
    {
        planned,
        active,
        closed,
        cancelled
    }
    public sealed class ShiftDto
    {
        [JsonPropertyName("shiftId")]
        public Guid ShiftId { get; init; }

        [JsonPropertyName("name")]
        public string? Name { get; init; } = "s";

        [JsonPropertyName("plannedStartAt")]
        public DateTimeOffset? PlannedStartAt { get; init; }

        [JsonPropertyName("plannedEndAt")]
        public DateTimeOffset? PlannedEndAt { get; init; }

        [JsonPropertyName("startedAt")]
        public DateTimeOffset? StartedAt { get; init; }

        [JsonPropertyName("endedAt")]
        public DateTimeOffset? EndedAt { get; init; }

        [JsonPropertyName("status")]
        public ShiftStatus Status { get; init; }

        [JsonPropertyName("createdAt")]
        public DateTimeOffset CreatedAt { get; init; }
    }

    public sealed class CreateShiftRequest
    {
        [JsonPropertyName("name")]
        public string? Name { get; init; } = "s";

        [JsonPropertyName("plannedStartAt")]
        public DateTimeOffset? PlannedStartAt { get; init; }

        [JsonPropertyName("plannedEndAt")]
        public DateTimeOffset? PlannedEndAt { get; init; }
    }

    public sealed class CloseShiftResponse
    {
        [JsonPropertyName("shiftId")]
        public Guid ShiftId { get; init; }

        [JsonPropertyName("endedAt")]
        public DateTimeOffset EndedAt { get; init; }
    }

    /* =========================
     * Shift Workers
     * ========================= */

    public sealed class ShiftWorkerDto
    {
        [JsonPropertyName("shiftWorkerId")]
        public Guid ShiftWorkerId { get; init; }

        [JsonPropertyName("shiftId")]
        public Guid ShiftId { get; init; }

        [JsonPropertyName("workerId")]
        public Guid WorkerId { get; init; }

        [JsonPropertyName("stationId")]
        public Guid? StationId { get; init; }

        [JsonPropertyName("positionSnapshot")]
        public string PositionSnapshot { get; init; } = "Worker";

        [JsonPropertyName("salaryCentsSnapshot")]
        public int? SalaryCentsSnapshot { get; init; }

        [JsonPropertyName("startedAt")]
        public DateTimeOffset StartedAt { get; init; }

        [JsonPropertyName("endedAt")]
        public DateTimeOffset? EndedAt { get; init; }

        [JsonPropertyName("deviceType")]
        public string DeviceType { get; init; } = DeviceTypeStrings.Fixed; // "fixed" | "personal"

        [JsonPropertyName("name")]
        public string Name { get; init; } = "(no name)";
    }

    public sealed class ClockInRequest
    {
        [JsonPropertyName("workerId")]
        public Guid WorkerId { get; init; }

        [JsonPropertyName("stationId")]
        public Guid? StationId { get; init; }

        // keep as string "fixed"/"personal" to match DB CHECK and avoid enum-string mapping issues at SQL layer
        [JsonPropertyName("deviceType")]
        public string DeviceType { get; init; } = DeviceTypeStrings.Fixed;
    }

    public sealed class ClockInResponse
    {
        [JsonPropertyName("shiftWorkerId")]
        public Guid ShiftWorkerId { get; init; }

        [JsonPropertyName("shiftId")]
        public Guid ShiftId { get; init; }

        [JsonPropertyName("workerId")]
        public Guid WorkerId { get; init; }

        [JsonPropertyName("stationId")]
        public Guid? StationId { get; init; }

        [JsonPropertyName("positionSnapshot")]
        public string PositionSnapshot { get; init; } = "Worker";

        [JsonPropertyName("salaryCentsSnapshot")]
        public int? SalaryCentsSnapshot { get; init; }

        [JsonPropertyName("startedAt")]
        public DateTimeOffset StartedAt { get; init; }

        [JsonPropertyName("deviceType")]
        public string DeviceType { get; init; } = DeviceTypeStrings.Fixed;
    }

    public sealed class ClockOutRequest
    {
        [JsonPropertyName("workerId")]
        public Guid WorkerId { get; init; }
    }

    public sealed class ClockOutResponse
    {
        [JsonPropertyName("shiftWorkerId")]
        public Guid ShiftWorkerId { get; init; }

        [JsonPropertyName("shiftId")]
        public Guid ShiftId { get; init; }

        [JsonPropertyName("workerId")]
        public Guid WorkerId { get; init; }

        [JsonPropertyName("startedAt")]
        public DateTimeOffset StartedAt { get; init; }

        [JsonPropertyName("endedAt")]
        public DateTimeOffset EndedAt { get; init; }
    }

    public sealed class CheckerMealDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Qty { get; set; }
        public int Done { get; set; }
        public bool Verified { get; set; }
    }

    public sealed class CheckerOrderDto
    {
        public Guid Id { get; set; }
        public string Table { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public List<CheckerMealDto> Meals { get; set; } = new();
    }

}