using System;
using System.Collections.Generic;
using System.IO;
using System.IO.MemoryMappedFiles;

namespace MiniRacingHUD.Telemetry.Providers;

public class AcRallyTelemetryProvider : ITelemetryProvider
{
    public string GameName => "Assetto Corsa Rally";

    public bool IsConnected => _mmf != null;

    private MemoryMappedFile? _mmf;
    private const string PhysicsMmfName = "Local\\acpmf_physics";

    private static readonly List<(string key, string label)> _fields = new()
    {
        ("gameId",            "0. Game ID"),
        ("packetId",          "1. Packet ID"),
        ("throttleInput",     "2. Throttle"),
        ("brakeInput",        "3. Brake"),
        ("fuel",              "4. Fuel"),
        ("gear",              "5. Gear"),
        ("gearRaw",           "6. Gear (Raw ACC)"),
        ("engineRate",        "7. Engine RPM"),
        ("steeringInput",     "8. Steering"),
        ("speedKmh",          "9. Speed (km/h)"),
        ("speedMs",           "10. Speed (m/s)"),
        ("gForceLateral",     "11. G Lat"),
        ("gForceLongitudinal","12. G Lon"),
        ("accGVertical",      "13. G Vert"),
        ("clutchInput",       "14. Clutch"),
    };

    public IReadOnlyList<(string key, string label)> Fields => _fields;

    private DateTime _lastReconnectAttempt = DateTime.MinValue;

    private readonly Dictionary<string, object> _reducedCache = new(11);

    public bool Connect()
    {
        _mmf?.Dispose();
        _mmf = null;
        TryReconnect();
        return true;
    }

    private void TryReconnect()
    {
        if ((DateTime.UtcNow - _lastReconnectAttempt).TotalSeconds < 2.0) return;
        _lastReconnectAttempt = DateTime.UtcNow;
        Connect();
    }

    public void Disconnect()
    {
        _mmf?.Dispose();
        _mmf = null;
    }

    public void Dispose()
    {
        Disconnect();
    }

    public Dictionary<string, object>? ReadTelemetry()
    {
        return DoRead(false);
    }

    public Dictionary<string, object>? ReadReduced()
    {
        return DoRead(true);
    }

    private Dictionary<string, object>? DoRead(bool reduced)
    {
        if (_mmf == null)
        {
            TryReconnect();
            return null;
        }

        try
        {
            using var stream = _mmf.CreateViewStream();
            using var reader = new BinaryReader(stream);

            int packetId = reader.ReadInt32();
            float gas = reader.ReadSingle();
            float brake = reader.ReadSingle();
            float fuel = reader.ReadSingle();
            int gear = reader.ReadInt32();
            int rpms = reader.ReadInt32();
            float steerAngle = reader.ReadSingle();
            float speedKmh = reader.ReadSingle();

            reader.ReadSingle(); reader.ReadSingle(); reader.ReadSingle();

            float accGLateral = reader.ReadSingle();
            float accGVertical = reader.ReadSingle();
            float accGLongitudinal = reader.ReadSingle();

            stream.Seek(364, SeekOrigin.Begin);
            float clutchRaw = reader.ReadSingle();
            float clutchInput = 1.0f - Math.Clamp(clutchRaw, 0f, 1f);

            int dr2Gear = gear switch
            {
                0 => -1,
                1 => 0,
                >= 2 => gear - 1,
                _ => 0
            };

            float steerNormalized = Math.Clamp(steerAngle, -1f, 1f);

            if (reduced)
            {
                _reducedCache.Clear();
                _reducedCache["gameId"] = 2;
                _reducedCache["gear"] = dr2Gear;
                _reducedCache["speed"] = speedKmh / 3.6f;
                _reducedCache["engineRate"] = (float)rpms;
                _reducedCache["steeringInput"] = steerNormalized;
                _reducedCache["throttleInput"] = gas;
                _reducedCache["brakeInput"] = brake;
                _reducedCache["clutchInput"] = clutchInput;
                return _reducedCache;
            }

            var result = new Dictionary<string, object>(20)
            {
                ["gameId"] = 2,
                ["throttleInput"] = gas,
                ["brakeInput"] = brake,
                ["steeringInput"] = steerNormalized,
                ["clutchInput"] = clutchInput,
                ["speed"] = speedKmh / 3.6f,
                ["speedMs"] = speedKmh / 3.6f,
                ["engineRate"] = (float)rpms,
                ["gear"] = dr2Gear,
                ["gForceLateral"] = accGLateral,
                ["gForceLongitudinal"] = accGLongitudinal,
                ["packetId"] = packetId,
                ["fuel"] = fuel,
                ["steerAngle"] = steerAngle,
                ["steerNormalized"] = steerNormalized,
                ["gearRaw"] = gear,
                ["speedKmh"] = speedKmh,
                ["accGVertical"] = accGVertical,
                ["clutchRaw"] = clutchRaw,
            };

            return result;
        }
        catch
        {
            _mmf?.Dispose();
            _mmf = null;
            TryReconnect();
            return null;
        }
    }
}
