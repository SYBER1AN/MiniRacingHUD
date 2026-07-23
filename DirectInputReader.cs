using System.Collections.Concurrent;
using Vortice.DirectInput;

namespace MiniRacingHUD;

public class DirectInputDeviceState
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public float[] Axes { get; set; } = [];
    public ButtonState[] Buttons { get; set; } = [];
}

public class ButtonState
{
    public bool Pressed { get; set; }
}

public class DirectInputReader : IDisposable
{
    private readonly IDirectInput8 _directInput;
    private readonly ConcurrentDictionary<Guid, CachedDevice> _devices = new();
    private readonly List<DirectInputDeviceState> _cache = new();
    private readonly Action<string>? _log;
    private readonly IntPtr _windowHandle;
    private int _deviceChangePending;
    private bool _disposed;

    private static readonly (JoystickOffset off, int idx)[] AxisMap =
    {
        (JoystickOffset.X, 0),
        (JoystickOffset.Y, 1),
        (JoystickOffset.Z, 2),
        (JoystickOffset.RotationX, 3),
        (JoystickOffset.RotationY, 4),
        (JoystickOffset.RotationZ, 5),
        (JoystickOffset.Sliders0, 6),
        (JoystickOffset.Sliders1, 7)
    };

    private const int ButtonCount = 128;
    private const int PovButtonCount = 4;
    private const int TotalButtonCount = ButtonCount + PovButtonCount;
    private const float AxisRangeMax = 65535;

    public DirectInputReader(IntPtr windowHandle, Action<string>? log = null)
    {
        _log = log;
        _windowHandle = windowHandle;
        _directInput = DInput.DirectInput8Create();
        EnumerateDevices();
    }

    public bool HasDevices => _devices.Count > 0;
    public int DeviceCount => _devices.Count;

    private void EnumerateDevices()
    {
        var deviceList = _directInput.GetDevices(DeviceClass.GameControl, DeviceEnumerationFlags.AttachedOnly);

        foreach (var deviceInstance in deviceList)
        {
            try
            {
                var device = _directInput.CreateDevice(deviceInstance.InstanceGuid);
                device.SetCooperativeLevel(_windowHandle, CooperativeLevel.Background | CooperativeLevel.NonExclusive);

                if (device.SetDataFormat<RawJoystickState>().Failure)
                {
                    _log?.Invoke($"[DirectInput] SetDataFormat failed for {deviceInstance.InstanceName}");
                    device.Dispose();
                    continue;
                }

                if (device.Acquire().Failure)
                {
                    _log?.Invoke($"[DirectInput] Acquire failed for {deviceInstance.InstanceName}");
                    device.Dispose();
                    continue;
                }

                var cached = new CachedDevice
                {
                    Device = device,
                    Name = deviceInstance.InstanceName,
                    InstanceGuid = deviceInstance.InstanceGuid
                };

                for (int i = 0; i < TotalButtonCount; i++)
                    cached.Buttons[i] = new ButtonState();

                _devices[deviceInstance.InstanceGuid] = cached;

                _log?.Invoke($"[DirectInput] Registered: {deviceInstance.InstanceName} ({deviceInstance.InstanceGuid})");
            }
            catch (Exception ex)
            {
                _log?.Invoke($"[DirectInput] Init error for {deviceInstance.InstanceName}: {ex.Message}");
            }
        }
    }

    public void NotifyDeviceChange()
    {
        Interlocked.Exchange(ref _deviceChangePending, 1);
    }

    private void ReEnumerate()
    {
        var attached = _directInput
            .GetDevices(DeviceClass.GameControl, DeviceEnumerationFlags.AttachedOnly)
            .Select(d => d.InstanceGuid)
            .ToHashSet();

        var detached = _devices.Keys.Where(g => !attached.Contains(g)).ToList();
        foreach (var guid in detached)
        {
            if (_devices.TryRemove(guid, out var dev))
            {
                try { dev.Device.Dispose(); } catch { }
                _log?.Invoke($"[DirectInput] Removed: {dev.Name}");
            }
        }

        foreach (var di in _directInput.GetDevices(DeviceClass.GameControl, DeviceEnumerationFlags.AttachedOnly))
        {
            if (_devices.ContainsKey(di.InstanceGuid)) continue;
            try
            {
                var device = _directInput.CreateDevice(di.InstanceGuid);
                device.SetCooperativeLevel(_windowHandle, CooperativeLevel.Background | CooperativeLevel.NonExclusive);

                if (device.SetDataFormat<RawJoystickState>().Failure)
                {
                    device.Dispose();
                    continue;
                }

                if (device.Acquire().Failure)
                {
                    device.Dispose();
                    continue;
                }

                var cached = new CachedDevice
                {
                    Device = device,
                    Name = di.InstanceName,
                    InstanceGuid = di.InstanceGuid
                };

                for (int i = 0; i < TotalButtonCount; i++)
                    cached.Buttons[i] = new ButtonState();

                _devices[di.InstanceGuid] = cached;
                _log?.Invoke($"[DirectInput] Added: {di.InstanceName}");
            }
            catch (Exception ex)
            {
                _log?.Invoke($"[DirectInput] Hotplug error for {di.InstanceName}: {ex.Message}");
            }
        }
    }

    public List<DirectInputDeviceState> PollAll()
    {
        if (Interlocked.Exchange(ref _deviceChangePending, 0) == 1)
            ReEnumerate();

        _cache.Clear();

        foreach (var kvp in _devices)
        {
            var dev = kvp.Value;
            try
            {
                if (dev.Device.Poll().Failure)
                {
                    _log?.Invoke($"[DirectInput] Poll failed for {dev.Name}");
                    HandleDeviceError(dev);
                    continue;
                }

                var state = dev.Device.GetCurrentJoystickState();

                for (int i = 0; i < AxisMap.Length; i++)
                {
                    int raw = ReadAxisByOffset(state, (int)AxisMap[i].off);
                    dev.Axes[i] = Math.Clamp(2.0f * raw / AxisRangeMax - 1.0f, -1.0f, 1.0f);
                }

                for (int i = 0; i < Math.Min(state.Buttons.Length, ButtonCount); i++)
                    dev.Buttons[i].Pressed = state.Buttons[i];
                for (int i = Math.Min(state.Buttons.Length, ButtonCount); i < ButtonCount; i++)
                    dev.Buttons[i].Pressed = false;

                int pov = state.PointOfViewControllers.Length > 0 ? state.PointOfViewControllers[0] : -1;
                dev.Buttons[ButtonCount + 0].Pressed = pov == 0 || pov == 4500 || pov == 31500;
                dev.Buttons[ButtonCount + 1].Pressed = pov == 9000 || pov == 4500 || pov == 13500;
                dev.Buttons[ButtonCount + 2].Pressed = pov == 18000 || pov == 13500 || pov == 22500;
                dev.Buttons[ButtonCount + 3].Pressed = pov == 27000 || pov == 22500 || pov == 31500;

                dev.State.Id = $"DI:{dev.Name} ({dev.InstanceGuid.ToString("D")[..8]})";
                dev.State.Name = dev.Name;
                dev.State.Axes = dev.Axes;
                dev.State.Buttons = dev.Buttons;

                _cache.Add(dev.State);
            }
            catch (Exception ex)
            {
                _log?.Invoke($"[DirectInput] PollAll error for {dev.Name}: {ex.Message}");
                HandleDeviceError(dev);
            }
        }

        return _cache;
    }

    private void HandleDeviceError(CachedDevice dev)
    {
        try
        {
            dev.Device.Unacquire();
            if (dev.Device.Acquire().Failure)
            {
                _log?.Invoke($"[DirectInput] Re-acquire failed for {dev.Name}, removing");
                _devices.TryRemove(dev.InstanceGuid, out _);
                dev.Device.Dispose();
            }
        }
        catch
        {
            _devices.TryRemove(dev.InstanceGuid, out _);
            try { dev.Device.Dispose(); } catch { }
        }
    }

    private static int ReadAxisByOffset(JoystickState state, int offset)
    {
        return offset switch
        {
            0 => state.X,
            4 => state.Y,
            8 => state.Z,
            12 => state.RotationX,
            16 => state.RotationY,
            20 => state.RotationZ,
            24 => state.Sliders.Length > 0 ? state.Sliders[0] : 0,
            28 => state.Sliders.Length > 1 ? state.Sliders[1] : 0,
            _ => 0
        };
    }

    private class CachedDevice
    {
        public required IDirectInputDevice8 Device { get; init; }
        public required string Name { get; init; }
        public required Guid InstanceGuid { get; init; }
        public readonly DirectInputDeviceState State = new();
        public readonly float[] Axes = new float[AxisMap.Length];
        public readonly ButtonState[] Buttons = new ButtonState[TotalButtonCount];
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        foreach (var dev in _devices.Values)
        {
            try { dev.Device.Unacquire(); } catch { }
            dev.Device.Dispose();
        }

        _devices.Clear();
        _directInput.Dispose();
    }
}
