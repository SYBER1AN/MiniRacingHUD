using System.Collections.Generic;

namespace MiniRacingHUD.Telemetry;

public interface ITelemetryProvider : System.IDisposable
{
    string GameName { get; }
    IReadOnlyList<(string key, string label)> Fields { get; }

    bool Connect();
    void Disconnect();
    bool IsConnected { get; }

    Dictionary<string, object>? ReadTelemetry();
    Dictionary<string, object>? ReadReduced();
}
