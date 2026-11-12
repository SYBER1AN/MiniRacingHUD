using System.Collections.Generic;

namespace MiniRacingHUD.Telemetry;

public interface ITelemetryProvider : System.IDisposable
{
    string GameName { get; }
    IReadOnlyList<(string key, string label)> Fields { get; }

    bool Connect();
    void Disconnect();
    bool IsConnected { get; }

    /// <summary>Счётчик принятых пакетов; 0 — провайдер не сообщает о новых данных.</summary>
    int PacketSeq => 0;

    Dictionary<string, object>? ReadTelemetry();
    Dictionary<string, object>? ReadReduced();
}
