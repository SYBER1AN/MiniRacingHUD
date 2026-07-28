using System;
using System.Collections.Generic;
using System.IO.MemoryMappedFiles;
using System.Text;
using MiniRacingHUD.Telemetry.GearMappings;

namespace MiniRacingHUD.Telemetry.Providers;

public class ScsTelemetryProvider : ITelemetryProvider
{
    public string GameName { get; }

    public bool IsConnected => _mmf != null;

    private MemoryMappedFile? _mmf;
    private MemoryMappedViewAccessor? _accessor;
    private DateTime _lastReconnectAttempt = DateTime.MinValue;

    private readonly Dictionary<string, object> _reducedCache = new(11);
    private readonly byte[] _stringBuf = new byte[STRING_LEN];

    private int _lastGearDash = int.MinValue;
    private int _lastSlot = int.MinValue;
    private bool _lastRange;
    private bool _lastSplitter;
    private int _lastSelectorCount = int.MinValue;
    private int _lastGearsForward = int.MinValue;
    private string _lastBrandHint = "";
    private string _lastCachedGearName = "";

    private const string MMF_NAME = "Local\\SCSTelemetry";
    private const int MMF_SIZE = 32 * 1024;
    private const int STRING_LEN = 64;

    private const int OFF_SDK_ACTIVE = 0;
    private const int OFF_PAUSED = 4;
    private const int OFF_TIME = 8;

    private const int OFF_GAME_ID = 52;
    private const int OFF_TRUCK_BRAND = 2364;
    private const int OFF_TRUCK_NAME = 2492;
    private const int OFF_SHIFTER_TYPE = 3196;

    private const int OFF_NEXT_REST_STOP = 500;
    private const int OFF_GEAR_SELECTED = 504;
    private const int OFF_GEAR_DASHBOARD = 508;
    private const int OFF_EARNED_XP = 640;

    private const int OFF_GEARS_FORWARD = 68;
    private const int OFF_GEARS_REVERSE = 72;
    private const int OFF_RETARDER_STEPS = 76;
    private const int OFF_SELECTOR_COUNT = 84;
    private const int OFF_SHIFTER_SLOT = 104;

    private const int OFF_PARK_BRAKE = 1566;
    private const int OFF_MOTOR_BRAKE = 1567;
    private const int OFF_ELECTRIC_ENABLED = 1575;
    private const int OFF_ENGINE_ENABLED = 1576;
    private const int OFF_SHIFTER_TOGGLE = 1606;
    private const int OFF_DIFF_LOCK = 1608;
    private const int OFF_LIFT_AXLE = 1609;
    private const int OFF_TRAILER_LIFT_AXLE = 1611;

    private const int OFF_SCALE = 700;
    private const int OFF_FUEL_CAPACITY = 704;
    private const int OFF_FUEL_WARNING = 708;
    private const int OFF_ADBLUE_CAPACITY = 712;
    private const int OFF_ADBLUE_WARNING = 716;
    private const int OFF_AIRPRESSURE_WARNING = 720;
    private const int OFF_AIRPRESSURE_EMERGENCY = 724;
    private const int OFF_OILPRESSURE_WARNING = 728;
    private const int OFF_WATERTEMP_WARNING = 732;
    private const int OFF_BATTERYVOLTAGE_WARNING = 736;
    private const int OFF_ENGINERPMMAX = 740;
    private const int OFF_DIFFRATIO = 744;
    private const int OFF_CARGOMASS = 748;
    private const int OFF_UNITMASS = 944;
    private const int OFF_SPEED = 948;
    private const int OFF_RPM = 952;
    private const int OFF_INPUT_STEERING = 956;
    private const int OFF_INPUT_THROTTLE = 960;
    private const int OFF_INPUT_BRAKE = 964;
    private const int OFF_INPUT_CLUTCH = 968;
    private const int OFF_GAME_STEERING = 972;
    private const int OFF_GAME_THROTTLE = 976;
    private const int OFF_GAME_BRAKE = 980;
    private const int OFF_GAME_CLUTCH = 984;

    private static readonly List<(string key, string label)> _fields = new()
    {
        ("gameId",              "0. Game ID"),
        ("sdkActive",           "1. SDK Active"),
        ("paused",              "2. Paused"),
        ("time",                "3. Timestamp"),
        ("gameIdScs",           "4. Game (0=unk 1=ETS2 2=ATS)"),
        ("truckBrand",          "5. Truck Brand"),
        ("truckName",           "6. Truck Name"),
        ("nextRestStop",        "7. Next Rest Stop"),
        ("gearSelected",        "8. Gear Selected"),
        ("gearDashboard",       "9. Gear Dashboard"),
        ("earnedXp",            "10. Earned XP"),
        ("scale",               "11. Scale"),
        ("fuelCapacity",        "12. Fuel Capacity (l)"),
        ("fuelWarning",         "13. Fuel Warning"),
        ("adblueCapacity",      "14. AdBlue Capacity (l)"),
        ("adblueWarning",       "15. AdBlue Warning"),
        ("airPressureWarning",  "16. Air Press. Warning (psi)"),
        ("airPressureEmergency","17. Air Press. Emergency (psi)"),
        ("oilPressureWarning",  "18. Oil Press. Warning (psi)"),
        ("waterTempWarning",    "19. Water Temp Warning (°C)"),
        ("batteryVoltageWarning","20. Battery Voltage Warning (V)"),
        ("engineRpmMax",        "21. Engine RPM Max"),
        ("diffRatio",           "22. Diff Ratio"),
        ("cargoMass",           "23. Cargo Mass (kg)"),
        ("unitMass",            "24. Unit Mass (kg)"),
        ("speed",               "25. Speed (m/s)"),
        ("speedKmh",            "26. Speed (km/h)"),
        ("rpm",                 "27. RPM"),
        ("inputSteering",       "28. Input Steering"),
        ("inputThrottle",       "29. Input Throttle"),
        ("inputBrake",          "30. Input Brake"),
        ("inputClutch",         "31. Input Clutch"),
        ("gearsForward",        "32. Gears Forward"),
        ("gearsReverse",        "33. Gears Reverse"),
        ("retarderSteps",       "34. Retarder Steps"),
        ("selectorCount",       "35. Selector Count"),
        ("shifterSlot",         "36. Shifter Slot"),
        ("parkBrake",           "37. Park Brake"),
        ("motorBrake",          "38. Motor Brake"),
        ("electricEnabled",     "39. Electric Enabled"),
        ("engineEnabled",       "40. Engine Enabled"),
        ("shifterToggle0",      "41. Range (upper/lower)"),
        ("shifterToggle1",      "42. Splitter (H/L)"),
        ("differentialLock",    "43. Diff Lock"),
        ("liftAxle",            "44. Lift Axle"),
        ("trailerLiftAxle",     "45. Trailer Lift Axle"),
        ("gearName",            "46. Gear Name (L/H)"),
        ("shifterType",         "47. Shifter Type"),
    };

    public IReadOnlyList<(string key, string label)> Fields => _fields;

    public ScsTelemetryProvider(string gameName)
    {
        GameName = gameName;
    }

    public ScsTelemetryProvider() : this("SCS Game") { }

    public bool Connect()
    {
        _mmf?.Dispose();
        _accessor?.Dispose();
        _mmf = null;
        _accessor = null;
        TryReconnect();
        return true;
    }

    public void Disconnect()
    {
        _accessor?.Dispose();
        _mmf?.Dispose();
        _accessor = null;
        _mmf = null;
    }

    public void Dispose() => Disconnect();

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
        if (_accessor == null || _mmf == null)
        {
            TryReconnect();
            return null;
        }

        try
        {
            if (_accessor.ReadByte(OFF_SDK_ACTIVE) == 0) return null;
            if (_accessor.ReadByte(OFF_PAUSED) != 0) return null;

            int gearSel = _accessor.ReadInt32(OFF_GEAR_SELECTED);
            int gearDash = _accessor.ReadInt32(OFF_GEAR_DASHBOARD);
            float speed = _accessor.ReadSingle(OFF_SPEED);
            float rpm = _accessor.ReadSingle(OFF_RPM);
            float gameSteer = _accessor.ReadSingle(OFF_GAME_STEERING);
            float gameThrottle = _accessor.ReadSingle(OFF_GAME_THROTTLE);
            float gameBrake = _accessor.ReadSingle(OFF_GAME_BRAKE);
            float gameClutch = _accessor.ReadSingle(OFF_GAME_CLUTCH);

            if (reduced)
            {
                uint gearsForward = _accessor.ReadUInt32(OFF_GEARS_FORWARD);
                uint selectorCount = _accessor.ReadUInt32(OFF_SELECTOR_COUNT);
                uint shifterSlot = _accessor.ReadUInt32(OFF_SHIFTER_SLOT);
                bool toggleRange = _accessor.ReadByte(OFF_SHIFTER_TOGGLE) != 0;
                bool toggleSplit = _accessor.ReadByte(OFF_SHIFTER_TOGGLE + 1) != 0;
                string truckBrand = ReadString(OFF_TRUCK_BRAND);

                string gearName = ComputeGearNameCached(
                    gearDash, (int)shifterSlot, toggleRange, toggleSplit,
                    (int)selectorCount, (int)gearsForward, truckBrand);

                _reducedCache.Clear();
                _reducedCache["gameId"] = 4;
                _reducedCache["gear"] = gearDash;
                _reducedCache["gearName"] = gearName;
                _reducedCache["speed"] = speed;
                _reducedCache["engineRate"] = rpm;
                _reducedCache["steeringInput"] = Math.Clamp(-gameSteer, -1f, 1f);
                _reducedCache["throttleInput"] = Math.Clamp(gameThrottle, 0f, 1f);
                _reducedCache["brakeInput"] = Math.Clamp(gameBrake, 0f, 1f);
                _reducedCache["clutchInput"] = Math.Clamp(gameClutch, 0f, 1f);
                _reducedCache["handbrake"] = _accessor.ReadByte(OFF_PARK_BRAKE) != 0;
                return _reducedCache;
            }

            var result = new Dictionary<string, object>(50);

            result["gameId"] = 4;
            result["sdkActive"] = _accessor.ReadByte(OFF_SDK_ACTIVE) != 0;
            result["paused"] = _accessor.ReadByte(OFF_PAUSED) != 0;
            result["time"] = _accessor.ReadUInt64(OFF_TIME);

            result["gameIdScs"] = _accessor.ReadUInt32(OFF_GAME_ID);
            result["truckBrand"] = ReadString(OFF_TRUCK_BRAND);
            result["truckName"] = ReadString(OFF_TRUCK_NAME);

            result["nextRestStop"] = _accessor.ReadInt32(OFF_NEXT_REST_STOP);
            result["gearSelected"] = gearSel;
            result["gearDashboard"] = _accessor.ReadInt32(OFF_GEAR_DASHBOARD);
            result["earnedXp"] = _accessor.ReadInt32(OFF_EARNED_XP);

            result["scale"] = _accessor.ReadSingle(OFF_SCALE);
            result["fuelCapacity"] = _accessor.ReadSingle(OFF_FUEL_CAPACITY);
            result["fuelWarning"] = _accessor.ReadSingle(OFF_FUEL_WARNING);
            result["adblueCapacity"] = _accessor.ReadSingle(OFF_ADBLUE_CAPACITY);
            result["adblueWarning"] = _accessor.ReadSingle(OFF_ADBLUE_WARNING);
            result["airPressureWarning"] = _accessor.ReadSingle(OFF_AIRPRESSURE_WARNING);
            result["airPressureEmergency"] = _accessor.ReadSingle(OFF_AIRPRESSURE_EMERGENCY);
            result["oilPressureWarning"] = _accessor.ReadSingle(OFF_OILPRESSURE_WARNING);
            result["waterTempWarning"] = _accessor.ReadSingle(OFF_WATERTEMP_WARNING);
            result["batteryVoltageWarning"] = _accessor.ReadSingle(OFF_BATTERYVOLTAGE_WARNING);
            result["engineRpmMax"] = _accessor.ReadSingle(OFF_ENGINERPMMAX);
            result["diffRatio"] = _accessor.ReadSingle(OFF_DIFFRATIO);
            result["cargoMass"] = _accessor.ReadSingle(OFF_CARGOMASS);
            result["unitMass"] = _accessor.ReadSingle(OFF_UNITMASS);

            result["speed"] = speed;
            result["speedKmh"] = speed * 3.6f;
            result["rpm"] = rpm;
            result["inputSteering"] = _accessor.ReadSingle(OFF_INPUT_STEERING);
            result["inputThrottle"] = _accessor.ReadSingle(OFF_INPUT_THROTTLE);
            result["inputBrake"] = _accessor.ReadSingle(OFF_INPUT_BRAKE);
            result["inputClutch"] = _accessor.ReadSingle(OFF_INPUT_CLUTCH);

            result["gearsForward"] = _accessor.ReadUInt32(OFF_GEARS_FORWARD);
            result["gearsReverse"] = _accessor.ReadUInt32(OFF_GEARS_REVERSE);
            result["retarderSteps"] = _accessor.ReadUInt32(OFF_RETARDER_STEPS);
            result["selectorCount"] = _accessor.ReadUInt32(OFF_SELECTOR_COUNT);
            result["shifterSlot"] = _accessor.ReadUInt32(OFF_SHIFTER_SLOT);

            bool parkBrake = _accessor.ReadByte(OFF_PARK_BRAKE) != 0;
            result["parkBrake"] = parkBrake;
            result["handbrake"] = parkBrake;
            result["motorBrake"] = _accessor.ReadByte(OFF_MOTOR_BRAKE) != 0;
            result["electricEnabled"] = _accessor.ReadByte(OFF_ELECTRIC_ENABLED) != 0;
            result["engineEnabled"] = _accessor.ReadByte(OFF_ENGINE_ENABLED) != 0;
            result["shifterToggle0"] = _accessor.ReadByte(OFF_SHIFTER_TOGGLE) != 0;
            result["shifterToggle1"] = _accessor.ReadByte(OFF_SHIFTER_TOGGLE + 1) != 0;
            result["differentialLock"] = _accessor.ReadByte(OFF_DIFF_LOCK) != 0;
            result["liftAxle"] = _accessor.ReadByte(OFF_LIFT_AXLE) != 0;
            result["trailerLiftAxle"] = _accessor.ReadByte(OFF_TRAILER_LIFT_AXLE) != 0;
            result["shifterType"] = ReadString(OFF_SHIFTER_TYPE);

            int sc = (int)(uint)result["selectorCount"]!;
            int gf = (int)(uint)result["gearsForward"]!;
            int ss = (int)(uint)result["shifterSlot"]!;
            bool tr = (bool)result["shifterToggle0"]!;
            bool ts = (bool)result["shifterToggle1"]!;

            result["gearName"] = ComputeGearNameCached(gearDash, ss, tr, ts, sc, gf, (string)result["truckBrand"]!);

            return result;
        }
        catch
        {
            Disconnect();
            TryReconnect();
            return null;
        }
    }

    private static string ComputeGearName(
        int gearDash, int slot, bool range, bool splitter,
        int selectorCount, int gearsForward, string brandHint = "")
    {
        var mappings = ScsGearboxDatabase.DetectAll(selectorCount, gearsForward, brandHint);
        foreach (var mapping in mappings)
        {
            var mapped = mapping.Resolve(slot, range, splitter);
            if (mapped != null) return mapped;
        }

        if (selectorCount >= 2 && gearDash > 0)
            return gearDash.ToString() + (splitter ? "H" : "L");

        return "";
    }

    private string ReadString(long offset)
    {
        _accessor!.ReadArray(offset, _stringBuf, 0, STRING_LEN);
        var str = Encoding.ASCII.GetString(_stringBuf);
        var nullIdx = str.IndexOf('\0');
        return nullIdx >= 0 ? str[..nullIdx] : str;
    }

    private string ComputeGearNameCached(
        int gearDash, int slot, bool range, bool splitter,
        int selectorCount, int gearsForward, string brandHint)
    {
        if (gearDash == _lastGearDash && slot == _lastSlot &&
            range == _lastRange && splitter == _lastSplitter &&
            selectorCount == _lastSelectorCount &&
            gearsForward == _lastGearsForward &&
            brandHint == _lastBrandHint)
        {
            return _lastCachedGearName;
        }

        _lastGearDash = gearDash;
        _lastSlot = slot;
        _lastRange = range;
        _lastSplitter = splitter;
        _lastSelectorCount = selectorCount;
        _lastGearsForward = gearsForward;
        _lastBrandHint = brandHint;

        _lastCachedGearName = ComputeGearName(gearDash, slot, range, splitter,
            selectorCount, gearsForward, brandHint);
        return _lastCachedGearName;
    }

    private void TryReconnect()
    {
        if ((DateTime.UtcNow - _lastReconnectAttempt).TotalSeconds < 2.0) return;
        _lastReconnectAttempt = DateTime.UtcNow;
        try
        {
            _mmf = MemoryMappedFile.OpenExisting(MMF_NAME, MemoryMappedFileRights.Read);
            _accessor = _mmf.CreateViewAccessor(0, MMF_SIZE, MemoryMappedFileAccess.Read);
        }
        catch { }
    }
}
