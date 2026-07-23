using System;
using System.Collections.Generic;

namespace MiniRacingHUD.Telemetry.Providers;

public class Dr2TelemetryProvider : UdpTelemetryProviderBase
{
    public override string GameName => "Dirt Rally 2.0";
    protected override int Port => 20777;

    private static readonly List<(string key, string label)> _fields = new()
    {
        ("totalTime",         "1. Total Time"),
        ("lapTime",           "2. Lap Time"),
        ("lapDistance",       "3. Lap Distance"),
        ("totalDistance",     "4. Total Distance"),
        ("positionX",         "5. Position X"),
        ("positionY",         "6. Position Y"),
        ("positionZ",         "7. Position Z"),
        ("speed",             "8. Speed (m/s)"),
        ("velocityX",         "9. Velocity X"),
        ("velocityY",         "10. Velocity Y"),
        ("velocityZ",         "11. Velocity Z"),
        ("leftDirX",          "12. Left Dir X"),
        ("leftDirY",          "13. Left Dir Y"),
        ("leftDirZ",          "14. Left Dir Z"),
        ("forwardDirX",       "15. Forward Dir X"),
        ("forwardDirY",       "16. Forward Dir Y"),
        ("forwardDirZ",       "17. Forward Dir Z"),
        ("suspensionPosBL",   "18. Suspension Pos BL"),
        ("suspensionPosBR",   "19. Suspension Pos BR"),
        ("suspensionPosFL",   "20. Suspension Pos FL"),
        ("suspensionPosFR",   "21. Suspension Pos FR"),
        ("suspensionVelBL",   "22. Suspension Vel BL"),
        ("suspensionVelBR",   "23. Suspension Vel BR"),
        ("suspensionVelFL",   "24. Suspension Vel FL"),
        ("suspensionVelFR",   "25. Suspension Vel FR"),
        ("wheelPatchSpeedBL", "26. Wheel Patch Speed BL"),
        ("wheelPatchSpeedBR", "27. Wheel Patch Speed BR"),
        ("wheelPatchSpeedFL", "28. Wheel Patch Speed FL"),
        ("wheelPatchSpeedFR", "29. Wheel Patch Speed FR"),
        ("throttleInput",     "30. Throttle Input"),
        ("steeringInput",     "31. Steering Input"),
        ("brakeInput",        "32. Brake Input"),
        ("clutchInput",       "33. Clutch Input"),
        ("gear",              "34. Gear"),
        ("gForceLateral",     "35. G-Force Lateral"),
        ("gForceLongitudinal","36. G-Force Longitudinal"),
        ("lap",               "37. Lap"),
        ("engineRate",        "38. Engine Rate"),
        ("nativeSliSupport",  "39. Native SLI Support"),
        ("racePosition",      "40. Race Position"),
        ("kersLevel",         "41. KERS Level"),
        ("kersLevelMax",      "42. KERS Level Max"),
        ("drs",               "43. DRS"),
        ("tractionControl",   "44. Traction Control"),
        ("abs",               "45. ABS"),
        ("fuelInTank",        "46. Fuel In Tank"),
        ("fuelCapacity",      "47. Fuel Capacity"),
        ("inPits",            "48. In Pits"),
        ("raceSector",        "49. Race Sector"),
        ("sectorTime1",       "50. Sector Time 1"),
        ("sectorTime2",       "51. Sector Time 2"),
        ("brakeTempBL",       "52. Brake Temp BL"),
        ("brakeTempBR",       "53. Brake Temp BR"),
        ("brakeTempFL",       "54. Brake Temp FL"),
        ("brakeTempFR",       "55. Brake Temp FR"),
        ("tyrePressureBL",    "56. Tyre Pressure BL"),
        ("tyrePressureBR",    "57. Tyre Pressure BR"),
        ("tyrePressureFL",    "58. Tyre Pressure FL"),
        ("tyrePressureFR",    "59. Tyre Pressure FR"),
        ("lapsCompleted",     "60. Laps Completed"),
        ("totalLaps",         "61. Total Laps"),
        ("trackLength",       "62. Track Length"),
        ("lastLapTime",       "63. Last Lap Time"),
        ("test1",             "64. Test 1"),
    };

    public override IReadOnlyList<(string key, string label)> Fields => _fields;

    protected override bool FilterPacket(byte[] buffer) => buffer.Length >= 256;

    protected override Dictionary<string, object> ParseFull(byte[] buffer)
    {
        var floats = new float[64];
        Buffer.BlockCopy(buffer, 0, floats, 0, Math.Min(buffer.Length, 256));

        return new Dictionary<string, object>
        {
            ["gameId"] = 0,
            ["totalTime"] = floats[0],
            ["lapTime"] = floats[1],
            ["lapDistance"] = floats[2],
            ["totalDistance"] = floats[3],
            ["positionX"] = floats[4],
            ["positionY"] = floats[5],
            ["positionZ"] = floats[6],
            ["speed"] = floats[7],
            ["velocityX"] = floats[8],
            ["velocityY"] = floats[9],
            ["velocityZ"] = floats[10],
            ["leftDirX"] = floats[11],
            ["leftDirY"] = floats[12],
            ["leftDirZ"] = floats[13],
            ["forwardDirX"] = floats[14],
            ["forwardDirY"] = floats[15],
            ["forwardDirZ"] = floats[16],
            ["suspensionPosBL"] = floats[17],
            ["suspensionPosBR"] = floats[18],
            ["suspensionPosFL"] = floats[19],
            ["suspensionPosFR"] = floats[20],
            ["suspensionVelBL"] = floats[21],
            ["suspensionVelBR"] = floats[22],
            ["suspensionVelFL"] = floats[23],
            ["suspensionVelFR"] = floats[24],
            ["wheelPatchSpeedBL"] = floats[25],
            ["wheelPatchSpeedBR"] = floats[26],
            ["wheelPatchSpeedFL"] = floats[27],
            ["wheelPatchSpeedFR"] = floats[28],
            ["throttleInput"] = floats[29],
            ["steeringInput"] = floats[30],
            ["brakeInput"] = floats[31],
            ["clutchInput"] = floats[32],
            ["gear"] = (int)Math.Round(floats[33]),
            ["gForceLateral"] = floats[34],
            ["gForceLongitudinal"] = floats[35],
            ["lap"] = (int)Math.Round(floats[36]),
            ["engineRate"] = floats[37],
            ["nativeSliSupport"] = floats[38],
            ["racePosition"] = (int)Math.Round(floats[39]),
            ["kersLevel"] = floats[40],
            ["kersLevelMax"] = floats[41],
            ["drs"] = floats[42],
            ["tractionControl"] = floats[43],
            ["abs"] = floats[44],
            ["fuelInTank"] = floats[45],
            ["fuelCapacity"] = floats[46],
            ["inPits"] = floats[47],
            ["raceSector"] = (int)Math.Round(floats[48]),
            ["sectorTime1"] = floats[49],
            ["sectorTime2"] = floats[50],
            ["brakeTempBL"] = floats[51],
            ["brakeTempBR"] = floats[52],
            ["brakeTempFL"] = floats[53],
            ["brakeTempFR"] = floats[54],
            ["tyrePressureBL"] = floats[55],
            ["tyrePressureBR"] = floats[56],
            ["tyrePressureFL"] = floats[57],
            ["tyrePressureFR"] = floats[58],
            ["lapsCompleted"] = (int)Math.Round(floats[59]),
            ["totalLaps"] = (int)Math.Round(floats[60]),
            ["trackLength"] = floats[61],
            ["lastLapTime"] = floats[62],
            ["test1"] = floats[63]
        };
    }

    private readonly Dictionary<string, object> _reducedCache = new(11);

    protected override Dictionary<string, object> ParseReduced(byte[] buffer)
    {
        _reducedCache.Clear();

        _reducedCache["gameId"] = 0;
        _reducedCache["speed"]  = BitConverter.ToSingle(buffer, 7 * 4);
        _reducedCache["throttleInput"]  = BitConverter.ToSingle(buffer, 29 * 4);
        _reducedCache["steeringInput"]  = BitConverter.ToSingle(buffer, 30 * 4);
        _reducedCache["brakeInput"]     = BitConverter.ToSingle(buffer, 31 * 4);
        _reducedCache["clutchInput"]    = BitConverter.ToSingle(buffer, 32 * 4);
        _reducedCache["gear"]    = (int)Math.Round(BitConverter.ToSingle(buffer, 33 * 4));
        _reducedCache["gForceLateral"]      = BitConverter.ToSingle(buffer, 34 * 4);
        _reducedCache["gForceLongitudinal"] = BitConverter.ToSingle(buffer, 35 * 4);
        _reducedCache["engineRate"] = BitConverter.ToSingle(buffer, 37 * 4);

        return _reducedCache;
    }
}
