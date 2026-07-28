using System.Runtime.InteropServices;

namespace MiniRacingHUD;

internal class KeyboardHook : IDisposable
{
    public event Action<int, bool>? KeyStateChanged;

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    private LowLevelKeyboardProc? _proc;
    private IntPtr _hookId = IntPtr.Zero;

    public bool IsRunning => _hookId != IntPtr.Zero;

    public void Start()
    {
        if (_hookId != IntPtr.Zero) return;
        _proc = HookCallback;
        _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(null), 0);
    }

    public void Stop()
    {
        if (_hookId != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_hookId);
            _hookId = IntPtr.Zero;
        }
        _proc = null;
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int vkCode = Marshal.ReadInt32(lParam);
            bool pressed = wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN;
            KeyStateChanged?.Invoke(vkCode, pressed);
        }
        return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
    }

    public void Dispose() => Stop();

    // --- Win32 ---
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x100;
    private const int WM_SYSKEYDOWN = 0x104;

    [DllImport("user32.dll")]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll")]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);
}
