using System;
using System.Collections.Generic;
using System.Text;

namespace MiniRacingHUD.Telemetry.Providers;

public class BeamNgTelemetryProvider : UdpTelemetryProviderBase
{
    public override string GameName => "BeamNG.drive";
    protected override int Port => 4444;

    private readonly object _motionSimLock = new();
    private byte[]? _lastMotionSimBuffer;

    private static readonly List<(string key, string label)> _fields = new()
    {
        ("speed",             "1. Speed (m/s)"),
        ("engineRate",        "2. RPM"),
        ("throttleInput",     "3. Throttle"),
        ("brakeInput",        "4. Brake"),
        ("clutchInput",       "5. Clutch"),
        ("gear",              "6. Gear"),
        ("handbrake",         "7. Handbrake"),
        ("turbo",             "8. Turbo (BAR)"),
        ("engTemp",           "9. Engine Temp (C)"),
        ("fuel",              "10. Fuel (0..1)"),
        ("oilTemp",           "11. Oil Temp (C)"),
        ("flags",             "12. Flags"),
        ("dashLights",        "13. Dash Lights"),
        ("showLights",        "14. Show Lights"),
        ("display1",          "15. Display 1"),
        ("display2",          "16. Display 2"),
        ("gearName",          "17. Gear Mode (P,R,N,D,S,M3...)"),
    };

    private static readonly List<(string key, string label)> _motionSimFields = new()
    {
        ("accX",              "MS Accel X (m/s²)"),
        ("accY",              "MS Accel Y (m/s²)"),
        ("accZ",              "MS Accel Z (m/s²)"),
        ("velX",              "MS Velocity X (m/s)"),
        ("velY",              "MS Velocity Y (m/s)"),
        ("velZ",              "MS Velocity Z (m/s)"),
        ("posX",              "MS Pos X (m)"),
        ("posY",              "MS Pos Y (m)"),
        ("posZ",              "MS Pos Z (m)"),
        ("rollPos",           "MS Roll (rad)"),
        ("pitchPos",          "MS Pitch (rad)"),
        ("yawPos",            "MS Yaw (rad)"),
    };

    public override IReadOnlyList<(string key, string label)> Fields
    {
        get
        {
            var combined = new List<(string key, string label)>(_fields);
            combined.AddRange(_motionSimFields);
            return combined;
        }
    }

    protected override bool FilterPacket(byte[] buffer) => true;

    protected override void ProcessPacket(byte[] buffer)
    {
        if (buffer.Length >= 88 &&
            buffer[0] == 0x42 && buffer[1] == 0x4E && buffer[2] == 0x47 && buffer[3] == 0x31)
        {
            lock (_motionSimLock)
            {
                _lastMotionSimBuffer = buffer;
            }
            return;
        }

        if (buffer.Length >= 92)
        {
            lock (_bufferLock)
            {
                _lastBuffer = buffer;
                _lastPacketTime = DateTime.UtcNow;
            }
        }
    }

    private static int GetDisplayStringLen(byte[] buffer, int offset, int maxLen)
    {
        var len = 0;
        while (len < maxLen && offset + len < buffer.Length && buffer[offset + len] != 0) len++;
        return len;
    }

    protected override Dictionary<string, object> ParseFull(byte[] buffer)
    {
        var flags = BitConverter.ToUInt16(buffer, 8);
        var dashLights = BitConverter.ToUInt32(buffer, 40);
        var showLights = BitConverter.ToUInt32(buffer, 44);

        var result = new Dictionary<string, object>
        {
            ["gameId"] = 3,
            ["speed"] = BitConverter.ToSingle(buffer, 12),
            ["engineRate"] = BitConverter.ToSingle(buffer, 16),
            ["turbo"] = BitConverter.ToSingle(buffer, 20),
            ["engTemp"] = BitConverter.ToSingle(buffer, 24),
            ["fuel"] = BitConverter.ToSingle(buffer, 28),
            ["oilTemp"] = BitConverter.ToSingle(buffer, 36),
            ["throttleInput"] = BitConverter.ToSingle(buffer, 48),
            ["brakeInput"] = BitConverter.ToSingle(buffer, 52),
            ["clutchInput"] = BitConverter.ToSingle(buffer, 56),
            ["flags"] = flags,
            ["dashLights"] = dashLights,
            ["showLights"] = showLights,
        };

        var gear = (sbyte)buffer[10];
        result["gear"] = gear;

        result["handbrake"] = (showLights & 4) != 0;

        var display1Len = GetDisplayStringLen(buffer, 60, 16);
        result["display1"] = Encoding.UTF8.GetString(buffer, 60, display1Len);
        result["gearName"] = Encoding.UTF8.GetString(buffer, 60, display1Len);

        var display2Len = GetDisplayStringLen(buffer, 76, 16);
        result["display2"] = Encoding.UTF8.GetString(buffer, 76, display2Len);

        return result;
    }

    private readonly Dictionary<string, object> _reducedCache = new(10);

    protected override Dictionary<string, object> ParseReduced(byte[] buffer)
    {
        _reducedCache.Clear();

        var showLights = BitConverter.ToUInt32(buffer, 44);

        _reducedCache["gameId"] = 3;
        _reducedCache["speed"] = BitConverter.ToSingle(buffer, 12);
        _reducedCache["engineRate"] = BitConverter.ToSingle(buffer, 16);
        _reducedCache["throttleInput"] = BitConverter.ToSingle(buffer, 48);
        _reducedCache["brakeInput"] = BitConverter.ToSingle(buffer, 52);
        _reducedCache["clutchInput"] = BitConverter.ToSingle(buffer, 56);
        _reducedCache["gear"] = (sbyte)buffer[10];
        _reducedCache["handbrake"] = (showLights & 4) != 0;
        _reducedCache["fuel"] = BitConverter.ToSingle(buffer, 28);

        var nameLen = GetDisplayStringLen(buffer, 60, 16);
        _reducedCache["gearName"] = Encoding.UTF8.GetString(buffer, 60, nameLen);

        lock (_motionSimLock)
        {
            if (_lastMotionSimBuffer != null)
                MergeMotionSim(_reducedCache, _lastMotionSimBuffer);
        }

        return _reducedCache;
    }

    private static void MergeMotionSim(Dictionary<string, object> data, byte[] msBuffer)
    {
        data["gForceLateral"] = -(BitConverter.ToSingle(msBuffer, 28)) / 9.81f;
        data["gForceLongitudinal"] = BitConverter.ToSingle(msBuffer, 32) / 9.81f;
    }
}
