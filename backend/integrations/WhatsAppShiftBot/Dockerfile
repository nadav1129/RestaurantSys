# --- base runtime image ---
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8082
ENV ASPNETCORE_URLS=http://+:8082

# --- build image ---
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# copy csproj and restore
# context will be /src = backend (because of docker-compose)
COPY ./integrations/WhatsAppShiftBot/WhatsAppWebhook.csproj ./integrations/WhatsAppShiftBot/
RUN dotnet restore "integrations/WhatsAppShiftBot/WhatsAppWebhook.csproj"

# copy everything and build
COPY . .
WORKDIR "/src/integrations/WhatsAppShiftBot"
RUN dotnet publish "WhatsAppWebhook.csproj" -c Release -o /app/publish

# --- final image ---
FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "WhatsAppWebhook.dll"]
