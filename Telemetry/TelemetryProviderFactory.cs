using System;
using System.Collections.Generic;

namespace MiniRacingHUD.Telemetry;

public static class TelemetryProviderFactory
{
    private static readonly Dictionary<string, Func<ITelemetryProvider>> _registry = new();

    static TelemetryProviderFactory()
    {
        Register<Providers.Dr2TelemetryProvider>("Dirt Rally 2.0");
        Register<Providers.Ams2TelemetryProvider>("Automobilista 2");
        Register<Providers.BeamNgTelemetryProvider>("BeamNG.drive");
        Register<Providers.AcRallyTelemetryProvider>("Assetto Corsa Rally");
    }

    public static void Register<T>(string gameName) where T : ITelemetryProvider, new()
    {
        _registry[gameName] = () => new T();
    }

    public static void Unregister(string gameName)
    {
        _registry.Remove(gameName);
    }

    public static ITelemetryProvider? Create(string gameName)
    {
        if (_registry.TryGetValue(gameName, out var factory))
            return factory();
        return null;
    }

    public static IEnumerable<string> RegisteredGames => _registry.Keys;
}
