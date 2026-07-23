using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;

namespace MiniRacingHUD;

public partial class ColorPicker : UserControl
{
    private bool _isDraggingHsv;
    private bool _isDraggingHue;
    private bool _isDraggingSat;
    private bool _isDraggingVal;
    private bool _isUpdating;

    private double _hue;        // 0–360
    private double _saturation; // 0–1
    private double _value;      // 0–1

    public static readonly RoutedEvent ColorChangedEvent =
        EventManager.RegisterRoutedEvent("ColorChanged", RoutingStrategy.Bubble,
            typeof(RoutedPropertyChangedEventHandler<Color>), typeof(ColorPicker));

    public event RoutedPropertyChangedEventHandler<Color> ColorChanged
    {
        add => AddHandler(ColorChangedEvent, value);
        remove => RemoveHandler(ColorChangedEvent, value);
    }

    // --- EyeDropper ---
    private bool _isEyeDropping;
    private Color _eyeDropCurrentColor;
    private IntPtr _mouseHookHandle;
    private IntPtr _keyboardHookHandle;
    private HookProc? _mouseHookProc;
    private HookProc? _keyboardHookProc;
    private DispatcherTimer? _eyeDropTimer;
    private Popup? _eyeDropPopup;
    private Rectangle? _eyeDropColorRect;
    private TextBlock? _eyeDropHexText;
    private delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);
    private Dictionary<uint, IntPtr> _originalSystemCursors = new();
    private static readonly uint[] SystemCursorIds =
    {
        32512, // OCR_NORMAL
        32513, // OCR_IBEAM
        32514, // OCR_WAIT
        32516, // OCR_UP
        32640, // OCR_SIZE
        32641, // OCR_ICON
        32642, // OCR_SIZENWSE
        32643, // OCR_SIZENESW
        32644, // OCR_SIZEWE
        32645, // OCR_SIZENS
        32646, // OCR_SIZEALL
        32648, // OCR_NO
        32649, // OCR_HAND
        32650, // OCR_APPSTARTING
        32651, // OCR_HELP
    };

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("gdi32.dll")]
    private static extern uint GetPixel(IntPtr hdc, int x, int y);

    [DllImport("user32.dll")]
    private static extern bool ReleaseDC(IntPtr hWnd, IntPtr hdc);

    [DllImport("user32.dll")]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll")]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X; public int Y; }

    private const int WH_MOUSE_LL = 14;
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_MOUSEMOVE = 0x200;
    private const int WM_LBUTTONDOWN = 0x201;
    private const int WM_RBUTTONDOWN = 0x204;
    private const int WM_KEYDOWN = 0x100;
    private const int VK_ESCAPE = 0x1B;
    private const int IDC_CROSS = 32515;

    [DllImport("user32.dll")]
    private static extern IntPtr SetCursor(IntPtr hCursor);

    [DllImport("user32.dll")]
    private static extern IntPtr LoadCursor(IntPtr hInstance, int lpCursorName);

    private static readonly IntPtr _crossCursor = LoadCursor(IntPtr.Zero, IDC_CROSS);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetSystemCursor(IntPtr hcur, uint id);

    [DllImport("user32.dll")]
    private static extern IntPtr CopyIcon(IntPtr hIcon);

    public ColorPicker()
    {
        InitializeComponent();
        SizeChanged += (_, _) =>
        {
            var w = hsvGrid.ActualWidth;
            if (w > 50)
                hsvBorder.Height = w;
        };
        SetColor(Color.FromRgb(0x97, 0xDD, 0x7A));
        Loaded += (_, _) => {
            if (!_isUpdating) UpdateUI();
            if (combinedPreview != null)
                combinedPreview.MouseDown += (_, e) =>
                {
                    if (e.LeftButton == MouseButtonState.Pressed)
                    {
                        SetColor(_oldPreviewColor);
                        NotifyColorChange();
                    }
                };
            if (resetOldBtn != null)
            {
                resetOldBtn.Style = Application.Current.TryFindResource("GrayButton") as Style;
                resetOldBtn.Click += (_, _) =>
                {
                    ResetToDefaultRequested?.Invoke();
                };
            }
            if (copyHexBtn != null)
            {
                copyHexBtn.Style = Application.Current.TryFindResource("ToolbarIconButton") as Style;
                copyHexBtn.Click += (_, _) =>
                {
                    try { System.Windows.Clipboard.SetText(hexField.Text); }
                    catch { }
                };
            }
            if (pasteHexBtn != null)
            {
                pasteHexBtn.Style = Application.Current.TryFindResource("ToolbarIconButton") as Style;
                pasteHexBtn.Click += (_, _) =>
                {
                    try
                    {
                        var text = System.Windows.Clipboard.GetText()?.Trim();
                        if (!string.IsNullOrEmpty(text) && System.Text.RegularExpressions.Regex.IsMatch(text, @"^#?[0-9a-fA-F]{6}$"))
                        {
                            var clean = text.Replace("#", "");
                            var color = (Color)ColorConverter.ConvertFromString("#" + clean);
                            SetColor(color);
                            _lastColor = default;
                            NotifyColorChange();
                        }
                    }
                    catch { }
                };
            }
            if (eyeDropBtn != null)
            {
                eyeDropBtn.Style = Application.Current.TryFindResource("ToolbarIconButton") as Style;
                eyeDropBtn.Click += (_, _) => EyeDropperStart();
            }
            _lastColor = GetColor();
            hexField.InputTextBox.TextChanged += HexBox_TextChanged;
        };
    }

    public void SetColor(Color color)
    {
        _isUpdating = true;
        var (h, s, v) = RgbToHsv(color);
        _hue = h;
        _saturation = s;
        _value = v;
        UpdateUI();
        _isUpdating = false;
    }

    public Color GetColor() => HsvToRgb(_hue, _saturation, _value);

    // --- HSV↔RGB ---
    private static (double h, double s, double v) RgbToHsv(Color c)
    {
        double r = c.R / 255.0, g = c.G / 255.0, b = c.B / 255.0;
        double max = Math.Max(r, Math.Max(g, b)), min = Math.Min(r, Math.Min(g, b));
        double h = 0, s = 0, v = max;
        double d = max - min;
        if (d > 0.001)
        {
            s = d / max;
            if (Math.Abs(max - r) < 0.001) h = 60 * ((g - b) / d % 6);
            else if (Math.Abs(max - g) < 0.001) h = 60 * ((b - r) / d + 2);
            else h = 60 * ((r - g) / d + 4);
            if (h < 0) h += 360;
        }
        return (h, s, v);
    }

    private static Color HsvToRgb(double h, double s, double v)
    {
        if (s < 0.001) return Color.FromRgb((byte)(v * 255), (byte)(v * 255), (byte)(v * 255));
        h /= 60;
        int i = (int)Math.Floor(h);
        double f = h - i;
        double p = v * (1 - s);
        double q = v * (1 - s * f);
        double t = v * (1 - s * (1 - f));
        return (i % 6) switch
        {
            0 => Make(v, t, p),
            1 => Make(q, v, p),
            2 => Make(p, v, t),
            3 => Make(p, q, v),
            4 => Make(t, p, v),
            5 => Make(v, p, q),
            _ => Make(v, t, p),
        };
    }

    private static Color Make(double r, double g, double b) =>
        Color.FromRgb((byte)(r * 255), (byte)(g * 255), (byte)(b * 255));

    // --- UI обновление ---
    private void UpdateUI()
    {
        var color = HsvToRgb(_hue, _saturation, _value);
        hueBg.Fill = new SolidColorBrush(HsvToRgb(_hue, 1, 1));
        hexField.Text = $"{color.R:X2}{color.G:X2}{color.B:X2}";
        UpdateCombinedPreview();

        var w = hsvGrid.ActualWidth;
        var h = hsvGrid.ActualHeight;
        if (w > 0 && h > 0)
        {
            const double markerOffset = 1;
            Canvas.SetLeft(marker, markerOffset + _saturation * w - 7);
            Canvas.SetTop(marker, markerOffset + (1 - _value) * h - 7);
        }

        if (hueThumb != null)
        {
            var sw = hueSlider.ActualWidth;
            if (sw > 0)
                Canvas.SetLeft(hueThumb, _hue / 360 * sw - 3);
        }

        if (satThumb != null)
        {
            var sw = satSlider.ActualWidth;
            if (sw > 0)
                Canvas.SetLeft(satThumb, _saturation * sw - 3);
        }
        if (satSlider != null)
        {
            var sw = satSlider.ActualWidth;
            if (sw > 0)
            {
                var satColor = HsvToRgb(_hue, 1, _value);
                var gray = Color.FromRgb((byte)(128 * _value), (byte)(128 * _value), (byte)(128 * _value));
                satSlider.Fill = new LinearGradientBrush(gray, satColor, new Point(0, 0), new Point(1, 0));
            }
        }

        if (valThumb != null)
        {
            var sw = valSlider.ActualWidth;
            if (sw > 0)
                Canvas.SetLeft(valThumb, _value * sw - 3);
        }
        if (valSlider != null)
        {
            var sw = valSlider.ActualWidth;
            if (sw > 0)
            {
                var topColor = HsvToRgb(_hue, _saturation, 1);
                var botColor = Colors.Black;
                valSlider.Fill = new LinearGradientBrush(botColor, topColor, new Point(0, 0), new Point(1, 0));
            }
        }
    }

    private void RaiseColorChanged(Color oldColor, Color newColor)
    {
        var args = new RoutedPropertyChangedEventArgs<Color>(oldColor, newColor, ColorChangedEvent);
        RaiseEvent(args);
    }

    private Color _lastColor;
    private Color _oldPreviewColor;
    public event Action? ResetToDefaultRequested;
    public void SetOldPreview(Color color)
    {
        _oldPreviewColor = color;
        UpdateCombinedPreview();
    }

    private void UpdateCombinedPreview()
    {
        if (combinedPreview == null) return;
        var grad = new LinearGradientBrush
        {
            StartPoint = new Point(0, 0),
            EndPoint = new Point(1, 0)
        };
        var newColor = GetColor();
        grad.GradientStops.Add(new GradientStop(_oldPreviewColor, 0.0));
        grad.GradientStops.Add(new GradientStop(_oldPreviewColor, 0.5));
        grad.GradientStops.Add(new GradientStop(newColor, 0.5));
        grad.GradientStops.Add(new GradientStop(newColor, 1.0));
        combinedPreview.Fill = grad;
    }

    private void NotifyColorChange()
    {
        var c = GetColor();
        if (c != _lastColor)
        {
            var old = _lastColor;
            _lastColor = c;
            RaiseColorChanged(old, c);
        }
    }

    // --- HSV поле ---
    private void HsvGrid_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            _isDraggingHsv = true;
            UpdateHsvFromPoint(e.GetPosition(hsvGrid));
            hsvGrid.CaptureMouse();
        }
    }

    private void HsvGrid_MouseMove(object sender, MouseEventArgs e)
    {
        if (_isDraggingHsv)
        {
            if (e.LeftButton == MouseButtonState.Pressed)
                UpdateHsvFromPoint(e.GetPosition(hsvGrid));
            else
                EndHsvDrag();
        }
    }

    private void HsvGrid_MouseUp(object sender, MouseButtonEventArgs e)
    {
        EndHsvDrag();
    }

    private void EndHsvDrag()
    {
        if (_isDraggingHsv)
        {
            _isDraggingHsv = false;
            hsvGrid.ReleaseMouseCapture();
        }
    }

    private void UpdateHsvFromPoint(Point pt)
    {
        var w = hsvGrid.ActualWidth;
        var h = hsvGrid.ActualHeight;
        if (w <= 0 || h <= 0) return;

        _isUpdating = true;
        _saturation = Math.Clamp(pt.X / w, 0, 1);
        _value = Math.Clamp(1 - pt.Y / h, 0, 1);
        UpdateUI();
        _isUpdating = false;
        NotifyColorChange();
    }

    // --- Hue слайдер ---
    private void HueSlider_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            _isDraggingHue = true;
            UpdateHueFromPoint(e.GetPosition(hueSlider));
            hueSlider.CaptureMouse();
        }
    }

    private void HueSlider_MouseMove(object sender, MouseEventArgs e)
    {
        if (_isDraggingHue)
        {
            if (e.LeftButton == MouseButtonState.Pressed)
                UpdateHueFromPoint(e.GetPosition(hueSlider));
            else
                EndHueDrag();
        }
    }

    private void HueSlider_MouseUp(object sender, MouseButtonEventArgs e)
    {
        EndHueDrag();
    }

    private void EndHueDrag()
    {
        if (_isDraggingHue)
        {
            _isDraggingHue = false;
            hueSlider.ReleaseMouseCapture();
        }
    }

    private void UpdateHueFromPoint(Point pt)
    {
        var w = hueSlider.ActualWidth;
        if (w <= 0) return;

        _isUpdating = true;
        _hue = Math.Clamp(pt.X / w, 0, 1) * 360;
        UpdateUI();
        _isUpdating = false;
        NotifyColorChange();
    }

    // --- Saturation слайдер ---
    private void SatSlider_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            _isDraggingSat = true;
            UpdateSatFromPoint(e.GetPosition(satSlider));
            satSlider.CaptureMouse();
        }
    }

    private void SatSlider_MouseMove(object sender, MouseEventArgs e)
    {
        if (_isDraggingSat)
        {
            if (e.LeftButton == MouseButtonState.Pressed)
                UpdateSatFromPoint(e.GetPosition(satSlider));
            else
                EndSatDrag();
        }
    }

    private void SatSlider_MouseUp(object sender, MouseButtonEventArgs e)
    {
        EndSatDrag();
    }

    private void EndSatDrag()
    {
        if (_isDraggingSat)
        {
            _isDraggingSat = false;
            satSlider.ReleaseMouseCapture();
        }
    }

    private void UpdateSatFromPoint(Point pt)
    {
        var w = satSlider.ActualWidth;
        if (w <= 0) return;

        _isUpdating = true;
        _saturation = Math.Clamp(pt.X / w, 0, 1);
        UpdateUI();
        _isUpdating = false;
        NotifyColorChange();
    }

    // --- Value/Brightness слайдер ---
    private void ValSlider_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            _isDraggingVal = true;
            UpdateValFromPoint(e.GetPosition(valSlider));
            valSlider.CaptureMouse();
        }
    }

    private void ValSlider_MouseMove(object sender, MouseEventArgs e)
    {
        if (_isDraggingVal)
        {
            if (e.LeftButton == MouseButtonState.Pressed)
                UpdateValFromPoint(e.GetPosition(valSlider));
            else
                EndValDrag();
        }
    }

    private void ValSlider_MouseUp(object sender, MouseButtonEventArgs e)
    {
        EndValDrag();
    }

    private void EndValDrag()
    {
        if (_isDraggingVal)
        {
            _isDraggingVal = false;
            valSlider.ReleaseMouseCapture();
        }
    }

    private void UpdateValFromPoint(Point pt)
    {
        var w = valSlider.ActualWidth;
        if (w <= 0) return;

        _isUpdating = true;
        _value = Math.Clamp(pt.X / w, 0, 1);
        UpdateUI();
        _isUpdating = false;
        NotifyColorChange();
    }

    // --- Hex ---
    private void HexBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (_isUpdating) return;
        var text = hexField.Text?.Trim();
        if (string.IsNullOrEmpty(text)) return;

        if (System.Text.RegularExpressions.Regex.IsMatch(text, @"^[0-9a-fA-F]{6}$"))
        {
            try
            {
                var color = (Color)ColorConverter.ConvertFromString("#" + text);
                SetColor(color);
                _lastColor = default;
                NotifyColorChange();
            }
            catch { }
        }
    }

    // --- EyeDropper ---
    private void EyeDropperStart()
    {
        if (_isEyeDropping) return;
        _isEyeDropping = true;

        // Global system cursor override (cross everywhere)
        SaveSystemCursors();
        SetSystemCursorsToCross();

        // Popup overlay
        _eyeDropColorRect = new Rectangle
        {
            Width = 40, Height = 26, RadiusX = 3, RadiusY = 3,
            Stroke = new SolidColorBrush(Color.FromRgb(0x55, 0x55, 0x55)),
            StrokeThickness = 1, Fill = Brushes.White,
            Margin = new Thickness(0, 0, 0, 4),
        };
        _eyeDropHexText = new TextBlock
        {
            Text = "#000000", FontFamily = new FontFamily("Consolas"),
            FontSize = 10,
            Foreground = new SolidColorBrush(Color.FromRgb(0xBB, 0xBB, 0xBB)),
            HorizontalAlignment = HorizontalAlignment.Center,
        };
        var stack = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center };
        stack.Children.Add(_eyeDropColorRect);
        stack.Children.Add(_eyeDropHexText);
        var border = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(210, 0, 0, 0)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(0x55, 0x55, 0x55)),
            BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(4),
            Padding = new Thickness(6), Child = stack,
        };
        _eyeDropPopup = new Popup
        {
            Child = border, Placement = PlacementMode.Absolute,
            AllowsTransparency = true, IsOpen = true,
        };

        // Hooks
        _mouseHookHandle = IntPtr.Zero;
        _keyboardHookHandle = IntPtr.Zero;
        _mouseHookProc = MouseHookCallback;
        _keyboardHookProc = KeyboardHookCallback;
        var module = GetModuleHandle(null);
        _mouseHookHandle = SetWindowsHookEx(WH_MOUSE_LL, _mouseHookProc, module, 0);
        _keyboardHookHandle = SetWindowsHookEx(WH_KEYBOARD_LL, _keyboardHookProc, module, 0);

        // Timer 1ms
        _eyeDropTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(1) };
        _eyeDropTimer.Tick += EyeDropTick;
        _eyeDropTimer.Start();

        Mouse.OverrideCursor = Cursors.Cross;
    }

    private void EyeDropTick(object? sender, EventArgs e)
    {
        SetCursor(_crossCursor);
        GetCursorPos(out var pt);
        var hdc = GetDC(IntPtr.Zero);
        uint pixel = 0;
        if (hdc != IntPtr.Zero)
        {
            pixel = GetPixel(hdc, pt.X, pt.Y);
            ReleaseDC(IntPtr.Zero, hdc);
        }

        _eyeDropCurrentColor = Color.FromRgb(
            (byte)(pixel & 0xFF),
            (byte)((pixel >> 8) & 0xFF),
            (byte)((pixel >> 16) & 0xFF)
        );

        if (_eyeDropColorRect != null)
            _eyeDropColorRect.Fill = new SolidColorBrush(_eyeDropCurrentColor);
        if (_eyeDropHexText != null)
            _eyeDropHexText.Text = $"#{_eyeDropCurrentColor.R:X2}{_eyeDropCurrentColor.G:X2}{_eyeDropCurrentColor.B:X2}";
        if (_eyeDropPopup != null)
        {
            var dpiScale = VisualTreeHelper.GetDpi(this).DpiScaleX;
            _eyeDropPopup.HorizontalOffset = pt.X / dpiScale + 8;
            _eyeDropPopup.VerticalOffset = pt.Y / dpiScale + 10;
        }
    }

    private IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            if (wParam == (IntPtr)WM_MOUSEMOVE)
            {
                SetCursor(_crossCursor);
                return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
            }
            if (wParam == (IntPtr)WM_LBUTTONDOWN)
            {
                SetCursor(_crossCursor);
                StopEyeDropper(capture: true);
                return (IntPtr)1;
            }
            if (wParam == (IntPtr)WM_RBUTTONDOWN)
            {
                SetCursor(_crossCursor);
                StopEyeDropper(capture: false);
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
    }

    private IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && wParam == (IntPtr)WM_KEYDOWN)
        {
            var vkCode = Marshal.ReadInt32(lParam);
            if (vkCode == VK_ESCAPE)
            {
                StopEyeDropper(capture: false);
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
    }

    private void StopEyeDropper(bool capture)
    {
        _isEyeDropping = false;
        Mouse.OverrideCursor = null;

        _eyeDropTimer?.Stop();
        _eyeDropTimer = null;

        if (_eyeDropPopup != null)
        {
            _eyeDropPopup.IsOpen = false;
            _eyeDropPopup = null;
        }

        if (_mouseHookHandle != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_mouseHookHandle);
            _mouseHookHandle = IntPtr.Zero;
        }
        if (_keyboardHookHandle != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_keyboardHookHandle);
            _keyboardHookHandle = IntPtr.Zero;
        }

        if (capture)
            StopEyeDropperApply();

        // Restore original system cursors
        RestoreSystemCursors();

        _eyeDropColorRect = null;
        _eyeDropHexText = null;
    }

    private void StopEyeDropperApply()
    {
        SetColor(_eyeDropCurrentColor);
        _lastColor = default;
        NotifyColorChange();
    }

    // --- System cursor override (global cross) ---
    private void SaveSystemCursors()
    {
        _originalSystemCursors.Clear();
        foreach (var id in SystemCursorIds)
        {
            try
            {
                var hCur = LoadCursor(IntPtr.Zero, (int)id);
                if (hCur != IntPtr.Zero)
                    _originalSystemCursors[id] = CopyIcon(hCur);
            }
            catch { }
        }
    }

    private void SetSystemCursorsToCross()
    {
        foreach (var id in SystemCursorIds)
        {
            try
            {
                var hCopy = CopyIcon(_crossCursor);
                if (hCopy != IntPtr.Zero)
                    SetSystemCursor(hCopy, id);
            }
            catch { }
        }
    }

    private void RestoreSystemCursors()
    {
        foreach (var kvp in _originalSystemCursors)
        {
            try
            {
                if (kvp.Value != IntPtr.Zero)
                    SetSystemCursor(kvp.Value, kvp.Key);
            }
            catch { }
        }
        _originalSystemCursors.Clear();
    }
}
