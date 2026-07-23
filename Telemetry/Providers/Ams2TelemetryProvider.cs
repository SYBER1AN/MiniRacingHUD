using System;
using System.Collections.Generic;
using System.Text;

namespace MiniRacingHUD.Telemetry.Providers;

public class Ams2TelemetryProvider : UdpTelemetryProviderBase
{
    public override string GameName => "Automobilista 2";
    protected override int Port => 5606;

    private readonly int[] _participantCarIndices = new int[32];
    private readonly Dictionary<int, string> _vehicleNames = new();
    private string? _lastResolvedCarName;

    private static readonly List<(string key, string label)> _fields = new()
    {
        ("carName",           "0. Car Name"),
        ("throttleInput",     "13. Throttle (raw)"),
        ("brakeInput",        "14. Brake (raw)"),
        ("steeringInput",     "15. Steering (raw)"),
        ("clutchInput",       "16. Clutch (raw)"),
        ("carFlags",          "17. Car Flags"),
        ("oilTemp",           "18. Oil Temp (C)"),
        ("oilPressure",       "20. Oil Pressure (kPa)"),
        ("waterTemp",         "22. Water Temp (C)"),
        ("waterPressure",     "24. Water Pressure (kPa)"),
        ("fuelPressure",      "26. Fuel Pressure (kPa)"),
        ("fuelCapacity",      "28. Fuel Capacity"),
        ("brakeState",        "29. Brake (filtered)"),
        ("throttleState",     "30. Throttle (filtered)"),
        ("clutchState",       "31. Clutch (filtered)"),
        ("fuelInTank",        "32. Fuel Level"),
        ("speed",             "36. Speed (m/s)"),
        ("engineRate",        "40. Engine RPM"),
        ("maxRpm",            "42. Max RPM"),
        ("steeringState",     "44. Steering (filtered)"),
        ("gear",              "45. Gear"),
        ("boostAmount",       "46. Boost Amount"),
        ("crashState",        "47. Crash State"),
        ("odometer",          "48. Odometer (km)"),
        ("localVelocityX",    "64. Local Vel X"),
        ("localVelocityY",    "68. Local Vel Y"),
        ("localVelocityZ",    "72. Local Vel Z"),
        ("worldVelocityX",    "76. World Vel X"),
        ("worldVelocityY",    "80. World Vel Y"),
        ("worldVelocityZ",    "84. World Vel Z"),
        ("angularVelX",       "88. Angular Vel X"),
        ("angularVelY",       "92. Angular Vel Y"),
        ("angularVelZ",       "96. Angular Vel Z"),
        ("gForceLateral",     "100. G-Force Lateral"),
        ("gForceVertical",    "104. G-Force Vertical"),
        ("gForceLongitudinal","108. G-Force Longitudinal"),
        ("worldAccelX",       "112. World Accel X"),
        ("worldAccelY",       "116. World Accel Y"),
        ("worldAccelZ",       "120. World Accel Z"),
        ("tyreRPS_FL",        "160. Tyre RPS FL"),
        ("tyreRPS_FR",        "164. Tyre RPS FR"),
        ("tyreRPS_RL",        "168. Tyre RPS RL"),
        ("tyreRPS_RR",        "172. Tyre RPS RR"),
        ("brakeTempFL",       "208. Brake Temp FL"),
        ("brakeTempFR",       "210. Brake Temp FR"),
        ("brakeTempRL",       "212. Brake Temp RL"),
        ("brakeTempRR",       "214. Brake Temp RR"),
        ("suspensionTravelFL","312. Susp Travel FL"),
        ("suspensionTravelFR","316. Susp Travel FR"),
        ("suspensionTravelRL","320. Susp Travel RL"),
        ("suspensionTravelRR","324. Susp Travel RR"),
        ("suspensionVelFL",   "328. Susp Vel FL"),
        ("suspensionVelFR",   "332. Susp Vel FR"),
        ("suspensionVelRL",   "336. Susp Vel RL"),
        ("suspensionVelRR",   "340. Susp Vel RR"),
        ("tyrePressureFL",    "352. Tyre Pressure FL"),
        ("tyrePressureFR",    "354. Tyre Pressure FR"),
        ("tyrePressureRL",    "356. Tyre Pressure RL"),
        ("tyrePressureRR",    "358. Tyre Pressure RR"),
        ("engineTorque",      "364. Engine Torque (Nm)"),
        ("handBrake",         "370. Hand Brake"),
        ("aeroDamage",        "371. Aero Damage"),
        ("engineDamage",      "372. Engine Damage"),
        ("brakeBias",         "554. Brake Bias"),
    };

    public override IReadOnlyList<(string key, string label)> Fields => _fields;

    protected override bool FilterPacket(byte[] buffer) => true;

    protected override void ProcessPacket(byte[] buffer)
    {
        if (buffer.Length < 11) return;

        byte packetType = buffer[10];

        if (packetType == 0)
        {
            if (buffer.Length < 556) return;
            lock (_bufferLock)
            {
                _lastBuffer = buffer;
                _lastPacketTime = DateTime.UtcNow;
            }
        }
        else if (packetType == 3 && buffer.Length >= 1059)
        {
            ParseParticipants(buffer);
        }
        else if (packetType == 8 && buffer.Length >= 84 && buffer.Length <= 1164)
        {
            _lastResolvedCarName = ParseVehicleNames(buffer);
        }
    }

    private void ParseParticipants(byte[] buffer)
    {
        int numParticipants = (sbyte)buffer[12];
        if (numParticipants < 0) return;
        if (numParticipants > 32) numParticipants = 32;
        for (int i = 0; i < numParticipants; i++)
        {
            int offset = 33 + i * 32;
            _participantCarIndices[i] = BitConverter.ToUInt16(buffer, offset + 18);
        }
    }

    private string? ParseVehicleNames(byte[] buffer)
    {
        if (buffer.Length < 84) return null;

        bool use70 = (buffer.Length - 12) % 70 == 0;
        int entrySize = use70 ? 70 : 72;
        int nameOff = use70 ? 6 : 8;
        int count = (buffer.Length - 12) / entrySize;
        if (count > 32) count = 32;

        string? firstCleanName = null;
        for (int i = 0; i < count; i++)
        {
            int offset = 12 + i * entrySize;
            int index = BitConverter.ToUInt16(buffer, offset);
            int nameLen = 0;
            while (nameLen < 64 && buffer[offset + nameOff + nameLen] != 0) nameLen++;
            var name = Encoding.UTF8.GetString(buffer, offset + nameOff, nameLen);
            if (string.IsNullOrEmpty(name)) continue;
            _vehicleNames[index] = name;
            firstCleanName ??= name;
        }
        return firstCleanName;
    }

    private string? ResolveCarName(byte[] buffer)
    {
        if (buffer.Length < 13) return null;
        sbyte viewedIdx = (sbyte)buffer[12];
        if (viewedIdx < 0 || viewedIdx >= _participantCarIndices.Length) return null;
        int carIdx = _participantCarIndices[viewedIdx] & 0x7FFF;
        if (_vehicleNames.TryGetValue(carIdx, out var name)) return name;
        return null;
    }

    protected override Dictionary<string, object> ParseFull(byte[] buffer)
    {
        var result = new Dictionary<string, object>();

        result["gameId"]         = 1;
        result["throttleInput"]  = buffer[13] / 255.0;
        result["brakeInput"]     = buffer[14] / 255.0;
        result["steeringInput"]  = Math.Clamp((sbyte)buffer[15] / 127.0, -1.0, 1.0);
        result["clutchInput"]    = buffer[16] / 255.0;
        result["carFlags"]       = buffer[17];
        result["oilTemp"]        = BitConverter.ToInt16(buffer, 18);
        result["oilPressure"]    = BitConverter.ToUInt16(buffer, 20);
        result["waterTemp"]      = BitConverter.ToInt16(buffer, 22);
        result["waterPressure"]  = BitConverter.ToUInt16(buffer, 24);
        result["fuelPressure"]   = BitConverter.ToUInt16(buffer, 26);
        result["fuelCapacity"]   = buffer[28];
        result["brakeState"]     = buffer[29] / 255.0;
        result["throttleState"]  = buffer[30] / 255.0;
        result["clutchState"]    = buffer[31] / 255.0;
        result["fuelInTank"]     = BitConverter.ToSingle(buffer, 32);
        result["speed"]          = BitConverter.ToSingle(buffer, 36);
        result["engineRate"]     = BitConverter.ToUInt16(buffer, 40);
        result["maxRpm"]         = BitConverter.ToUInt16(buffer, 42);
        result["steeringState"]  = Math.Clamp((sbyte)buffer[44] / 127.0, -1.0, 1.0);
        result["gear"]           = buffer[45] & 0x0F;
        result["boostAmount"]    = buffer[46];
        result["crashState"]     = buffer[47];
        result["odometer"]       = BitConverter.ToSingle(buffer, 48);

        result["localVelocityX"] = BitConverter.ToSingle(buffer, 64);
        result["localVelocityY"] = BitConverter.ToSingle(buffer, 68);
        result["localVelocityZ"] = BitConverter.ToSingle(buffer, 72);

        result["worldVelocityX"] = BitConverter.ToSingle(buffer, 76);
        result["worldVelocityY"] = BitConverter.ToSingle(buffer, 80);
        result["worldVelocityZ"] = BitConverter.ToSingle(buffer, 84);

        result["angularVelX"]    = BitConverter.ToSingle(buffer, 88);
        result["angularVelY"]    = BitConverter.ToSingle(buffer, 92);
        result["angularVelZ"]    = BitConverter.ToSingle(buffer, 96);

        result["gForceLateral"]     = BitConverter.ToSingle(buffer, 100);
        result["gForceVertical"]    = BitConverter.ToSingle(buffer, 104);
        result["gForceLongitudinal"]= BitConverter.ToSingle(buffer, 108);

        result["worldAccelX"]    = BitConverter.ToSingle(buffer, 112);
        result["worldAccelY"]    = BitConverter.ToSingle(buffer, 116);
        result["worldAccelZ"]    = BitConverter.ToSingle(buffer, 120);

        result["tyreRPS_FL"]     = BitConverter.ToSingle(buffer, 160);
        result["tyreRPS_FR"]     = BitConverter.ToSingle(buffer, 164);
        result["tyreRPS_RL"]     = BitConverter.ToSingle(buffer, 168);
        result["tyreRPS_RR"]     = BitConverter.ToSingle(buffer, 172);

        result["brakeTempFL"]    = BitConverter.ToInt16(buffer, 208);
        result["brakeTempFR"]    = BitConverter.ToInt16(buffer, 210);
        result["brakeTempRL"]    = BitConverter.ToInt16(buffer, 212);
        result["brakeTempRR"]    = BitConverter.ToInt16(buffer, 214);

        result["suspensionTravelFL"] = BitConverter.ToSingle(buffer, 312);
        result["suspensionTravelFR"] = BitConverter.ToSingle(buffer, 316);
        result["suspensionTravelRL"] = BitConverter.ToSingle(buffer, 320);
        result["suspensionTravelRR"] = BitConverter.ToSingle(buffer, 324);

        result["suspensionVelFL"] = BitConverter.ToSingle(buffer, 328);
        result["suspensionVelFR"] = BitConverter.ToSingle(buffer, 332);
        result["suspensionVelRL"] = BitConverter.ToSingle(buffer, 336);
        result["suspensionVelRR"] = BitConverter.ToSingle(buffer, 340);

        result["tyrePressureFL"] = BitConverter.ToUInt16(buffer, 352);
        result["tyrePressureFR"] = BitConverter.ToUInt16(buffer, 354);
        result["tyrePressureRL"] = BitConverter.ToUInt16(buffer, 356);
        result["tyrePressureRR"] = BitConverter.ToUInt16(buffer, 358);

        result["engineTorque"]   = BitConverter.ToSingle(buffer, 364);
        result["handBrake"]      = buffer[370];
        result["aeroDamage"]     = buffer[371];
        result["engineDamage"]   = buffer[372];
        result["brakeBias"]      = buffer[554];

        return result;
    }

    private readonly Dictionary<string, object> _reducedCache = new(13);

    protected override Dictionary<string, object> ParseReduced(byte[] buffer)
    {
        _reducedCache.Clear();

        _reducedCache["gameId"] = 1;
        _reducedCache["throttleInput"] = buffer[13] / 255.0;
        _reducedCache["brakeInput"] = buffer[14] / 255.0;
        _reducedCache["steeringInput"] = Math.Clamp((sbyte)buffer[15] / 127.0, -1.0, 1.0);
        _reducedCache["clutchInput"] = buffer[16] / 255.0;
        _reducedCache["speed"] = BitConverter.ToSingle(buffer, 36);
        _reducedCache["engineRate"] = BitConverter.ToUInt16(buffer, 40);
        _reducedCache["fuelInTank"] = BitConverter.ToSingle(buffer, 32);
        _reducedCache["gear"] = buffer[45] & 0x0F;
        _reducedCache["gForceLateral"] = BitConverter.ToSingle(buffer, 100) / 9.81f;
        _reducedCache["gForceLongitudinal"] = BitConverter.ToSingle(buffer, 108) / 9.81f;
        _reducedCache["handbrake"] = buffer[370] != 0;

        var carName = ResolveCarName(buffer);
        if (carName != null)
            _reducedCache["carName"] = carName;

        return _reducedCache;
    }
}
