using System.Collections.Generic;

namespace MiniRacingHUD.Telemetry.GearMappings;

public class GearboxMapping
{
    public required string Name { get; init; }
    public int SelectorCount { get; init; }
    public int MinForwardGears { get; init; }

    private readonly Dictionary<(int slot, bool range, bool split), string> _map = new();

    public void Add(int slot, bool range, bool splitter, string display)
    {
        _map[(slot, range, splitter)] = display;
    }

    public string? Resolve(int slot, bool range, bool splitter)
    {
        if (slot == 0) return null;
        if (_map.TryGetValue((slot, range, splitter), out var result))
            return result;
        return null;
    }
}
