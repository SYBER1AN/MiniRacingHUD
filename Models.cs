using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using Res = MiniRacingHUD.Properties.Resources;

namespace MiniRacingHUD;

public static class BuiltInGames
{
    public static readonly List<GameUdpConfig> Configs = new()
    {
        new() { Name = Res.Constants_NoTelemetry, ProcessName = "", UdpPort = 0, UdpEnabled = false, HasTelemetrySupport = false, LinkedPreset = "Default" },
        new() { Name = "Assetto Corsa Rally", ProcessName = "acr", UdpPort = 0, UdpEnabled = true, HasTelemetrySupport = true, LinkedPreset = "ACR" },
        new() { Name = "Automobilista 2", ProcessName = "ams2", UdpPort = 5606, UdpEnabled = true, HasTelemetrySupport = true, LinkedPreset = "AMS2" },
        new() { Name = "Dirt Rally 2.0", ProcessName = "dirtrally2", UdpPort = 20777, UdpEnabled = true, HasTelemetrySupport = true, LinkedPreset = "DR2" },
        new() { Name = "BeamNG.drive", ProcessName = "BeamNG.drive.x64", UdpPort = 4444, UdpEnabled = true, HasTelemetrySupport = true, LinkedPreset = "BeamNG" },
        new() { Name = "Euro Truck Simulator 2", ProcessName = "eurotrucks2", UdpPort = 0, UdpEnabled = true, HasTelemetrySupport = true, LinkedPreset = "ETS2" },
        new() { Name = "American Truck Simulator", ProcessName = "amtrucks", UdpPort = 0, UdpEnabled = true, HasTelemetrySupport = true, LinkedPreset = "ATS" },
    };
    public static HashSet<string> Names => Configs.Select(c => c.Name).ToHashSet();
}

public class GameUdpConfig
{
    public string Name { get; set; } = "";
    public string ProcessName { get; set; } = "";
    public int UdpPort { get; set; }
    public bool UdpEnabled { get; set; } = true;
    public string LinkedPreset { get; set; } = "";
    public bool HasTelemetrySupport { get; set; } = true;

    [JsonIgnore]
    public bool HandbrakeInTelemetry => Name switch
    {
        "BeamNG.drive" or "Automobilista 2" or "Euro Truck Simulator 2" or "American Truck Simulator" => true,
        _ => false
    };

    [JsonIgnore]
    public bool SteeringInTelemetry => Name switch
    {
        "BeamNG.drive" => false,
        _ => true
    };

    [JsonIgnore]
    public bool IsSharedMemory => UdpPort == 0 && HasTelemetrySupport;

}

public class AppConfig
{
    public static string NoTelemetryName => Res.Constants_NoTelemetry;
    public static string AddGameLabel => Res.Constants_AddGame;

    public int WsPort { get; set; } = 20888;
    public string? HtmlPath { get; set; }
    public bool MinimizeToTray { get; set; } = false;
    public bool AutoDetectEnabled { get; set; } = true;
    public bool MinimizeOnStart { get; set; } = false;
    public string? UiTheme { get; set; } = "light";
    public bool DonationReminderShown { get; set; } = false;
    public bool UseDiMode { get; set; } = false;
    public string Language { get; set; } = "ru";
    public string SelectedGame { get; set; } = NoTelemetryName;
    public bool UdpEnabled { get; set; } = true;

    public List<GameUdpConfig> CustomGameConfigs { get; set; } = new();

    [JsonIgnore]
    public List<GameUdpConfig> GameConfigs => 
        BuiltInGames.Configs.Concat(CustomGameConfigs).ToList();

    [JsonIgnore]
    public List<GameUdpConfig> AllGameConfigs => GameConfigs;
}

public class WindowSite
{
public int Left { get; set; }
public int Top { get; set; }
public int Width { get; set; }
public int Height { get; set; }
public string? State { get; set; }
}

public class ThemeColors
{
    public string? widgetBg { get; set; }
    public string? wheelRim { get; set; }
    public string? wheelSpoke { get; set; }
    public string? wheelMarker { get; set; }
    public string? gmeterMiddle { get; set; }
    public string? gmeterInner { get; set; }
    public string? gmeterOuter { get; set; }
    public string? gmeterBall { get; set; }
    public string? gmeterCrosshairDashed { get; set; }
    public string? gmeterRingsDashed { get; set; }
    public string? gmeterTrail { get; set; }
    public string? gmeterBorder { get; set; }
    public string? gearBg { get; set; }
    public string? gearText { get; set; }
    public string? gearNBg { get; set; }
    public string? gearNText { get; set; }
    public string? gearRBg { get; set; }
    public string? gearRText { get; set; }
    public string? pedalBg { get; set; }
    public string? pedalHandbrake { get; set; }
    public string? pedalClutch { get; set; }
    public string? pedalBrake { get; set; }
    public string? pedalThrottle { get; set; }
    public string? pedalText { get; set; }
    public string? graphGrid { get; set; }
    public string? graphText { get; set; }
}

public class UIColors
{
    public string? pageBg { get; set; }
    public string? panelBg { get; set; }
    public string? sectionBg { get; set; }
    public string? elementBg { get; set; }
    public string? accent { get; set; }
    public string? bindCont { get; set; }
    public string? panelCont { get; set; }
    public string? elementCont { get; set; }
    public string? helpBg { get; set; }
    public string? helpCont { get; set; }
    public string? helpHeading { get; set; }
    public string? disabledBg { get; set; }
    public string? disabledCont { get; set; }
    public string? border { get; set; }
    public string? lastActive { get; set; }
    public string? scrollbarTrack { get; set; }
    public string? dangerBg { get; set; }
    public string? dangerCont { get; set; }
    public string? toggleOff { get; set; }
    public string? toggleOn { get; set; }
    public string? codeBg { get; set; }
    public string? codeCont { get; set; }

}

public class GameSelectorItem
{
    public string Name { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public bool IsSeparator { get; set; }
    public bool IsAction { get; set; }
    public bool IsCustom { get; set; }
    public bool IsNoTelemetry { get; set; }
    public int GameIndex { get; set; } = -1;
}

public class WindowGeometry
{
public WindowSite Main { get; set; } = new() { Width = 1260, Height = 880, State = "Normal" };
public WindowSite? Telemetry { get; set; }
public WindowSite? ColorEditor { get; set; }
public WindowSite? ThemeEditor { get; set; }
}
