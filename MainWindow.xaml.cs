using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shell;
using Microsoft.Web.WebView2.Core;
using Fleck;
using System.Diagnostics;
using System.Globalization;
using System.Threading;
using System.Windows.Documents;
using System.Windows.Interop;
using MiniRacingHUD.Properties;
using MiniRacingHUD.Telemetry;

namespace MiniRacingHUD;

public partial class MainWindow : Window
{
    private AppConfig _appConfig = new();
    private GameUdpConfig CurrentGame =>
        _appConfig.GameConfigs.FirstOrDefault(g => g.Name == _appConfig.SelectedGame)
        ?? _appConfig.GameConfigs[0];

    private bool IsCurrentGame(string name) => _appConfig.SelectedGame == name;
    private readonly string _configPath;

    private ITelemetryProvider? _provider;
    private readonly SemaphoreSlim _udpLock = new(1, 1);
    private int _udpChanging;
    private ConcurrentDictionary<Guid, IWebSocketConnection> _wsClients = new();
    private Fleck.WebSocketServer? _wsServer;
    private bool _isRunning;
    private Window? _udpDataWindow;
    private System.Threading.Timer? _broadcastTimer;
    private System.Windows.Threading.DispatcherTimer? _copyTimer;
    private System.Windows.Threading.DispatcherTimer? _statusTimer;
    private bool _dataReceived = false;
    private bool _isBlankNavigation;
    private bool _startupTelemetryShown;
    private enum UdpStatus { Off, On, Err, Dash, ShmemOn, ShmemOff }
    private UdpStatus _udpStatus = UdpStatus.Dash;
    private string _udpConnStatus = "";

    private readonly string _windowGeometryPath;
    private WindowGeometry _windowGeometry = new();
    private System.Windows.Threading.DispatcherTimer? _pageReadyFallback;
    private Hardcodet.Wpf.TaskbarNotification.TaskbarIcon? _trayIcon;
    private System.Windows.Threading.DispatcherTimer? _autoDetectTimer;
    private bool _isAutoDetecting;
    private int _autoDetectBusy;
    private int _broadcastTickBusy;
    private int _lastBroadcastSeq;
    private readonly Dictionary<string, object> _broadcastData = new(16);
    private static readonly System.Text.Json.JsonSerializerOptions _telemetryJsonOptions = new();
    private static readonly HttpClient _tvdHttp = new() { Timeout = TimeSpan.FromMilliseconds(800) };
    private System.Threading.Timer? _tvdTimer;
    private int _tvdTickBusy;
    private int _tvdPort;
    private string? _lastTvdResult;
    private bool _tvdPreviewEnabled;
    private DateTime _tvdRetryAfter = DateTime.MinValue;
    private string _baseDir = "";
    private string _currentUiTheme = "light";
    private UIColors _colorOverrides = new();
    private ColorEditorWindow? _colorEditorWindow;
    private ThemeEditorWindow? _themeEditorWindow;
    private DirectInputReader? _directInputReader;
    private HwndSourceHook? _wndProcHook;
    private KeyboardHook? _keyboardHook;
    private int _diPollTickBusy;
    private static readonly JsonSerializerOptions _diJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
    private System.Threading.Timer? _diPollTimer;

    private List<(string key, string label)> CurrentFields =>
        _provider?.Fields.ToList() ?? new List<(string, string)>();

    private static readonly string _logPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "MiniRacingHUD.log");

    private static void Log(string message)
    {
        System.Diagnostics.Debug.WriteLine(message);
#if DEBUG
        try { System.IO.File.AppendAllText(_logPath, $"[{DateTime.Now:HH:mm:ss.fff}] {message}\n"); } catch { }
#endif
    }

    public MainWindow()
    {
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        _configPath = System.IO.Path.Combine(baseDir, "AppConfig.json");
        _windowGeometryPath = System.IO.Path.Combine(baseDir, "Window.json");
        _baseDir = baseDir;

        InitializeComponent();

        var ver = System.Reflection.Assembly.GetExecutingAssembly()
            .GetCustomAttribute<System.Reflection.AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion ?? "0.0.0";
        UpdateTitle(ver);

        LoadConfig();
        _currentUiTheme = _appConfig.UiTheme ?? "light";
        LoadWindowGeometry();

#if DEBUG
        colorEditorBtn.Visibility = Visibility.Visible;
#endif

        trayToggle.IsChecked = _appConfig.MinimizeToTray;
        trayToggle.Checked += TrayToggle_Checked;
        trayToggle.Unchecked += TrayToggle_Unchecked;
        if (trayToggle.IsChecked == true)
            CreateTrayIcon();

        autoDetectToggle.IsChecked = _appConfig.AutoDetectEnabled;
        autoDetectToggle.Checked += (_, _) => { _appConfig.AutoDetectEnabled = true; SaveConfig(); };
        autoDetectToggle.Unchecked += (_, _) => { _appConfig.AutoDetectEnabled = false; SaveConfig(); };

        minimizeOnStartToggle.IsChecked = _appConfig.MinimizeOnStart;
        minimizeOnStartToggle.Checked += (_, _) => { _appConfig.MinimizeOnStart = true; SaveConfig(); };
        minimizeOnStartToggle.Unchecked += (_, _) => { _appConfig.MinimizeOnStart = false; SaveConfig(); };

        InitGameSelector();
        InitLanguageSelector();
        gameSelector.SelectionChanged += GameSelector_SelectionChanged;
        gameSelector.AddHandler(Button.ClickEvent, new RoutedEventHandler((s, e) =>
        {
            if (e.OriginalSource is Button btn && btn.DataContext is GameSelectorItem item && item.IsCustom && !item.IsNoTelemetry)
            {
                e.Handled = true;
                DeleteGame(item);
            }
        }));

        Closing += MainWindow_Closing;
        StateChanged += MainWindow_StateChanged;

        LocalizationManager.CultureChanged += (_, _) =>
        {
            var ver = System.Reflection.Assembly.GetExecutingAssembly()
                .GetCustomAttribute<System.Reflection.AssemblyInformationalVersionAttribute>()
                ?.InformationalVersion ?? "0.0.0";
            UpdateTitle(ver);
            InitGameSelector();
            UpdatePortDisplay();
            UpdateStatusTexts();

            try
            {
                var langMsg = System.Text.Json.JsonSerializer.Serialize(new
                {
                    action = "interfaceLanguageChange",
                    interfaceLanguage = _appConfig.Language
                });
                webView.CoreWebView2?.PostWebMessageAsJson(langMsg);
            }
            catch { }
        };
    }

    private void InitGameSelector()
    {
        var builtInNames = MiniRacingHUD.BuiltInGames.Names;
        var items = new List<GameSelectorItem>();

        // No telemetry — отдельный пункт в начале
        var noTelConfig = MiniRacingHUD.BuiltInGames.Configs[0];
        items.Add(new GameSelectorItem
        {
            Name = noTelConfig.Name,
            DisplayName = noTelConfig.Name,
            IsNoTelemetry = true
        });

        // Встроенные игры (без NoTelemetry)
        for (int i = 1; i < MiniRacingHUD.BuiltInGames.Configs.Count; i++)
        {
            var g = MiniRacingHUD.BuiltInGames.Configs[i];
            items.Add(new GameSelectorItem { Name = g.Name, DisplayName = g.Name });
        }
        // Разделитель
        items.Add(new GameSelectorItem { Name = "separator", DisplayName = "separator", IsSeparator = true });
        // Пользовательские игры
        for (int i = 0; i < _appConfig.CustomGameConfigs.Count; i++)
        {
            var g = _appConfig.CustomGameConfigs[i];
            items.Add(new GameSelectorItem { Name = g.Name, DisplayName = g.Name, IsCustom = true });
        }
        // Добавить игру...
        items.Add(new GameSelectorItem { Name = AppConfig.AddGameLabel, DisplayName = AppConfig.AddGameLabel, IsAction = true });
        gameSelector.ItemsSource = items;
        gameSelector.SelectedIndex = items.FindIndex(item => item.Name == _appConfig.SelectedGame && !item.IsNoTelemetry);
        if (gameSelector.SelectedIndex < 0)
        {
            var noTelItem = items.FindIndex(item => item.IsNoTelemetry);
            gameSelector.SelectedIndex = noTelItem >= 0 ? noTelItem : 0;
        }
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        if (_appConfig.MinimizeOnStart)
            WindowState = WindowState.Minimized;
    }

    private void LoadConfig()
    {
        try
        {
            if (System.IO.File.Exists(_configPath))
            {
                var json = System.IO.File.ReadAllText(_configPath);
                if (string.IsNullOrWhiteSpace(json))
                {
                    _appConfig = new AppConfig();
                    return;
                }

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var config = JsonSerializer.Deserialize<AppConfig>(json, options);
                if (config != null)
                {
                    _appConfig = config;
                    _appConfig.CustomGameConfigs ??= new();

                    if (!_appConfig.GameConfigs.Any(g => g.Name == _appConfig.SelectedGame))
                        _appConfig.SelectedGame = _appConfig.GameConfigs[0].Name;
                    SaveConfig();
                    return;
                }
            }
        }
        catch (Exception ex)
        {
            Log(string.Format(Properties.Resources.Error_ConfigParse, ex.Message));
            UpdateStatus(Properties.Resources.Error_ConfigLoad);
        }

        _appConfig = new AppConfig();
        SaveConfig();
    }

    private void SaveConfig()
    {
        try
        {
            var json = JsonSerializer.Serialize(_appConfig, new JsonSerializerOptions { WriteIndented = true });
            System.IO.File.WriteAllText(_configPath, json);
        }
        catch (Exception ex)
        {
            UpdateStatus(string.Format(Properties.Resources.Error_ConfigSave, ex.Message));
        }
    }

    private async Task SaveConfigAsync()
    {
        try
        {
            var json = JsonSerializer.Serialize(_appConfig, new JsonSerializerOptions { WriteIndented = true });
            await System.IO.File.WriteAllTextAsync(_configPath, json);
        }
        catch (Exception ex)
        {
            Dispatcher.Invoke(() => UpdateStatus(string.Format(Properties.Resources.Error_ConfigSave, ex.Message)));
        }
    }

    private string ColorsPath => System.IO.Path.Combine(_baseDir, $"colors_{_currentUiTheme}.json");

    private void LoadColors()
    {
        try
        {
            var path = ColorsPath;
            if (System.IO.File.Exists(path))
            {
                var json = System.IO.File.ReadAllText(path);
                _colorOverrides = System.Text.Json.JsonSerializer.Deserialize<UIColors>(json) ?? new();
            }
        }
        catch { _colorOverrides = new(); }
    }

    private void SaveColors()
    {
        try
        {
            var json = System.Text.Json.JsonSerializer.Serialize(_colorOverrides, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
            System.IO.File.WriteAllText(ColorsPath, json);
        }
        catch (Exception ex) { Log(string.Format(Properties.Resources.Error_ColorsSave, ex.Message)); }
    }

    private void SendColorsToJs()
    {
        try
        {
            var msg = System.Text.Json.JsonSerializer.Serialize(new { action = "colorUpdate", colors = _colorOverrides });
            webView?.CoreWebView2?.PostWebMessageAsJson(msg);
        }
        catch { }
    }

    private async Task RefreshColorEditorDefaultsAsync()
    {
        try
        {
            var json = await webView.CoreWebView2.ExecuteScriptAsync("getDefaultCssColors()");
            var parsed = System.Text.Json.JsonSerializer.Deserialize<UIColors>(json);
            if (parsed != null)
                _colorEditorWindow?.Refresh(_colorOverrides, parsed);
        }
        catch { }
    }

    private async void OpenColorEditor_Click(object sender, RoutedEventArgs e)
    {
        if (_colorEditorWindow != null)
        {
            _colorEditorWindow.Close();
            return;
        }

        var defaults = new UIColors();
        try
        {
            var json = await webView.CoreWebView2.ExecuteScriptAsync("getDefaultCssColors()");
            var parsed = System.Text.Json.JsonSerializer.Deserialize<UIColors>(json);
            if (parsed != null) defaults = parsed;
        }
        catch { }

        var win = new ColorEditorWindow(_colorOverrides, defaults,
            onApplySave: newColors =>
            {
                _colorOverrides = newColors;
                SaveColors();
                SendColorsToJs();
            },
            onPreview: newColors =>
            {
                try
                {
                    var opts = new System.Text.Json.JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };
                    var msg = System.Text.Json.JsonSerializer.Serialize(new { action = "colorUpdate", colors = newColors }, opts);
                    webView?.CoreWebView2?.PostWebMessageAsJson(msg);
                }
                catch { }
            },
            geometryPath: _windowGeometryPath);
        win.Owner = this;
        _colorEditorWindow = win;
        win.Closed += (_, _) => _colorEditorWindow = null;
        win.Show();
    }

    private async void OpenThemeEditor_Click(object sender, RoutedEventArgs e)
    {
        if (_themeEditorWindow != null)
        {
            _themeEditorWindow.Close();
            return;
        }

        var defaults = new ThemeColors();
        try
        {
            var json = await webView.CoreWebView2.ExecuteScriptAsync("getCurrentThemeColors()");
            var parsed = System.Text.Json.JsonSerializer.Deserialize<ThemeColors>(json);
            if (parsed != null) defaults = parsed;
        }
        catch { }

        var themeName = "Default";
        try
        {
            var js = await webView.CoreWebView2.ExecuteScriptAsync("(currentConfig && currentConfig.theme) || document.documentElement.getAttribute('data-theme') || 'Default'");
            if (js != null) themeName = System.Text.Json.JsonSerializer.Deserialize<string>(js) ?? "Default";
        }
        catch { }

        var builtInThemes = await GetBuiltInThemesAsync();
        var win = new ThemeEditorWindow(defaults, defaults, themeName,
            isBuiltInTheme: name => builtInThemes.Contains(name.Trim()),
            onSave: (displayName, colors) => SaveThemeToFile(displayName, colors),
            onPreview: newColors =>
            {
                try
                {
                    var opts = new System.Text.Json.JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };
                    var msg = System.Text.Json.JsonSerializer.Serialize(new { action = "colorUpdate", colors = newColors }, opts);
                    webView?.CoreWebView2?.PostWebMessageAsJson(msg);
                }
                catch { }
            },
            geometryPath: _windowGeometryPath);
        win.Owner = this;
        _themeEditorWindow = win;
        win.Closed += (_, _) => _themeEditorWindow = null;
        win.Show();
    }

    private HashSet<string> _cachedBuiltInThemes = new(StringComparer.OrdinalIgnoreCase);

    private async Task<HashSet<string>> GetBuiltInThemesAsync()
    {
        try
        {
            var json = await webView.CoreWebView2.ExecuteScriptAsync("Object.keys(THEME_NAMES)");
            var list = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
            if (list != null)
                _cachedBuiltInThemes = new HashSet<string>(list, StringComparer.OrdinalIgnoreCase);
        }
        catch { }
        return _cachedBuiltInThemes;
    }

    private string? SaveThemeToFile(string displayName, ThemeColors colors)
    {
        try
        {
            var name = displayName.Trim();
            if (_cachedBuiltInThemes.Contains(name)) return Properties.Resources.Validation_ThemeNameTaken;

            var dir = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Widget", "themes");
            System.IO.Directory.CreateDirectory(dir);
            var fileName = name.Replace(' ', '_') + ".json";
            var path = System.IO.Path.Combine(dir, fileName);
            var colorsWithHash = HashTheme(colors);
            var data = new { name, colors = colorsWithHash };
            var json = System.Text.Json.JsonSerializer.Serialize(data, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
            System.IO.File.WriteAllText(path, json);

            var colorMsg = System.Text.Json.JsonSerializer.Serialize(new { action = "colorUpdate", name = displayName, colors });
            foreach (var kvp in _wsClients)
            {
                var c = kvp.Value;
                _ = Task.Run(() => { try { c.Send(colorMsg); } catch { } });
            }

            SendCustomThemeList();
            SendColorsToWs();

            var themeMsg = System.Text.Json.JsonSerializer.Serialize(new { action = "themeChange", theme = displayName });
            webView?.CoreWebView2?.PostWebMessageAsJson(themeMsg);
            return null;
        }
        catch (Exception ex) { return string.Format(Properties.Resources.Error_ThemeSave, ex.Message); }
    }

    private static ThemeColors HashTheme(ThemeColors src)
    {
        var dst = new ThemeColors();
        foreach (var prop in typeof(ThemeColors).GetProperties())
        {
            if (prop.PropertyType != typeof(string)) continue;
            var val = (string?)prop.GetValue(src);
            if (val != null && !val.StartsWith("#"))
                prop.SetValue(dst, "#" + val);
            else
                prop.SetValue(dst, val);
        }
        return dst;
    }

    private void SendCustomThemeList()
    {
        try
        {
            var dir = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Widget", "themes");
            if (!System.IO.Directory.Exists(dir)) return;
            var themes = new List<object>();
            foreach (var f in System.IO.Directory.GetFiles(dir, "*.json"))
            {
                try
                {
                    var doc = System.Text.Json.JsonDocument.Parse(System.IO.File.ReadAllText(f));
                    if (doc.RootElement.TryGetProperty("name", out _))
                        themes.Add(doc.RootElement.Clone());
                }
                catch { }
            }
            var msg = System.Text.Json.JsonSerializer.Serialize(new { action = "customThemeList", themes });
            webView?.CoreWebView2?.PostWebMessageAsJson(msg);
            foreach (var kvp in _wsClients)
            {
                var c = kvp.Value;
                var id = kvp.Key;
                _ = Task.Run(() => { try { c.Send(msg); } catch { _wsClients.TryRemove(id, out _); } });
            }
        }
        catch { }
    }

    /// <summary>
    /// Отправляет цвета последней изменённой кастомной темы всем WS-клиентам.
    /// </summary>
    private void SendColorsToWs()
    {
        try
        {
            var dir = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Widget", "themes");
            if (!System.IO.Directory.Exists(dir)) return;

            var lastTheme = System.IO.Directory.GetFiles(dir, "*.json")
                .OrderByDescending(f => System.IO.File.GetLastWriteTime(f))
                .FirstOrDefault();

            if (lastTheme == null) return;

            var json = System.IO.File.ReadAllText(lastTheme);
            var doc = System.Text.Json.JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("colors", out var colorsProp))
            {
                var colorsObj = System.Text.Json.JsonSerializer.Deserialize<ThemeColors>(colorsProp.GetRawText());
                if (colorsObj != null)
                {
                    var msg = System.Text.Json.JsonSerializer.Serialize(new { action = "themeColors", colors = colorsObj }, _diJsonOptions);
                    try { webView?.CoreWebView2?.PostWebMessageAsJson(msg); } catch { }
                    foreach (var kvp in _wsClients)
                    {
                        var c = kvp.Value;
                        _ = Task.Run(() => { try { c.Send(msg); } catch { } });
                    }
                }
            }
        }
        catch { }
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (_isShuttingDown) return;
        e.Cancel = true;
        _ = ShutdownAsync();
    }

    private void SaveGeometryAndState()
    {
        if (WindowState == WindowState.Normal)
        {
            _windowGeometry.Main.Left = (int)Math.Round(Left);
            _windowGeometry.Main.Top = (int)Math.Round(Top);
            _windowGeometry.Main.Width = (int)Math.Round(Width);
            _windowGeometry.Main.Height = (int)Math.Round(Height);
        }
        else
        {
            _windowGeometry.Main.Left = (int)Math.Round(RestoreBounds.Left);
            _windowGeometry.Main.Top = (int)Math.Round(RestoreBounds.Top);
            _windowGeometry.Main.Width = (int)Math.Round(RestoreBounds.Width);
            _windowGeometry.Main.Height = (int)Math.Round(RestoreBounds.Height);
        }
        _windowGeometry.Main.State = WindowState.ToString();
        SaveWindowGeometry();
    }

    private async Task ShutdownAsync()
    {
        if (_isShuttingDown) return;
        _isShuttingDown = true;

        try
        {
            SaveGeometryAndState();
            SaveConfig();

            _autoDetectTimer?.Stop();
            await StopUDPAsync();

            // Переключаем всех WS-клиентов на GP перед закрытием
            SendDiModeToJs(false);
            await Task.Delay(50);

            StopWebSocket();
            StopKeyboardHook();
            _trayIcon?.Dispose();
            _provider?.Dispose();
            if (_diPollTimer != null) { _diPollTimer.Dispose(); _diPollTimer = null; }
            if (_wndProcHook != null)
            {
                var src = HwndSource.FromHwnd(new WindowInteropHelper(this).Handle);
                src?.RemoveHook(_wndProcHook);
                _wndProcHook = null;
            }
            _directInputReader?.Dispose();
        }
        catch (Exception ex) { Log($"Shutdown error: {ex.Message}"); }

        Application.Current.Shutdown();
    }

    private void MainWindow_StateChanged(object? sender, EventArgs e)
    {
        if (WindowState == WindowState.Minimized)
        {
            if (trayToggle.IsChecked == true)
                ShowInTaskbar = false;
        }
        else
        {
            ShowInTaskbar = true;
            var pad = SystemParameters.WindowResizeBorderThickness;
            rootGrid.Margin = WindowState == WindowState.Maximized
                ? new Thickness(pad.Left, pad.Top, pad.Right, pad.Bottom)
                : new Thickness(0);
            maximizeBtn.Content = WindowState == WindowState.Maximized ? "❐" : "☐";
            maximizeBtn.ToolTip = WindowState == WindowState.Maximized ? Properties.Resources.Tooltip_RestoreDown : Properties.Resources.Tooltip_Maximize;
        }
    }

    private void LoadWindowGeometry()
    {
        try
        {
            if (!System.IO.File.Exists(_windowGeometryPath)) return;
            var json = System.IO.File.ReadAllText(_windowGeometryPath);
            var geo = JsonSerializer.Deserialize<WindowGeometry>(json);
            if (geo?.Main == null) return;
            _windowGeometry = geo;

            var site = _windowGeometry.Main;
            if (!IsRectOnAnyScreen(site.Left, site.Top, site.Width, site.Height))
                return;

            Left = site.Left;
            Top = site.Top;
            Width = site.Width;
            Height = site.Height;
            if (site.State == "Maximized")
                WindowState = WindowState.Maximized;
        }
        catch { Log("LoadWindowGeometry error"); }
    }

    private void SaveWindowGeometry()
    {
        try
        {
            WindowGeometry geo;
            if (System.IO.File.Exists(_windowGeometryPath))
            {
                var existingJson = System.IO.File.ReadAllText(_windowGeometryPath);
                geo = JsonSerializer.Deserialize<WindowGeometry>(existingJson) ?? new WindowGeometry();
            }
            else
            {
                geo = new WindowGeometry();
            }
            geo.Main = _windowGeometry.Main;
            var json = JsonSerializer.Serialize(geo, new JsonSerializerOptions { WriteIndented = true });
            System.IO.File.WriteAllText(_windowGeometryPath, json);
        }
        catch { Log("SaveWindowGeometry error"); }
    }

    private static bool IsRectOnAnyScreen(double left, double top, double width, double height)
    {
        double vsLeft = SystemParameters.VirtualScreenLeft;
        double vsTop = SystemParameters.VirtualScreenTop;
        double vsRight = vsLeft + SystemParameters.VirtualScreenWidth;
        double vsBottom = vsTop + SystemParameters.VirtualScreenHeight;
        double rRight = left + width;
        double rBottom = top + height;
        return rRight > vsLeft && left < vsRight &&
               rBottom > vsTop && top < vsBottom;
    }

    private string _currentHtmlPath = "";
    private string _rawHtmlPath = "";
    private bool _isShuttingDown;

    private string FormatDisplayPath(string path)
    {
        var tb = htmlPathField.InputTextBox;
        double availableWidth = tb.ActualWidth;
        if (availableWidth <= 10) availableWidth = 200;

        var typeface = new Typeface(tb.FontFamily, tb.FontStyle, tb.FontWeight, tb.FontStretch);

        var fullFt = new FormattedText(path, CultureInfo.CurrentCulture,
            FlowDirection.LeftToRight, typeface, tb.FontSize, Brushes.White, 1.0);
        if (fullFt.Width <= availableWidth) return path;

        var oneFt = new FormattedText("W", CultureInfo.CurrentCulture,
            FlowDirection.LeftToRight, typeface, tb.FontSize, Brushes.White, 1.0);
        double cw = oneFt.Width;
        if (cw <= 0) cw = 7;

        int totalChars = (int)(availableWidth / cw);
        int charsForText = totalChars - 3;
        if (charsForText < 2)
            return path[..1] + "..." + path[^1..];

        int head = charsForText / 2 + (charsForText % 2);
        int tail = charsForText - head;
        if (head >= path.Length || tail >= path.Length) return path;

        return path[..head] + "..." + path[^tail..];
    }

    private string ResolveSourcePath(string relativePath)
    {
        if (System.IO.Path.IsPathRooted(relativePath))
            return relativePath;
        return System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, relativePath);
    }

    private void ReloadHtml()
    {
        string htmlPath;

        if (!string.IsNullOrEmpty(_appConfig.HtmlPath) && System.IO.File.Exists(_appConfig.HtmlPath))
        {
            htmlPath = _appConfig.HtmlPath;
        }
        else
        {
            htmlPath = ResolveSourcePath(System.IO.Path.Combine("Widget", "MiniRacingHUD.html"));
        }

        _currentHtmlPath = htmlPath;

        if (System.IO.File.Exists(htmlPath))
        {
            htmlNotFoundOverlay.Visibility = Visibility.Collapsed;
            var uriWithPort = $"{new Uri(htmlPath).AbsoluteUri}?wsport={_appConfig.WsPort}";
            webView.CoreWebView2.Navigate(uriWithPort);
        }
        else
        {
            _isBlankNavigation = true;
            UpdateStatus(string.Format(Properties.Resources.Error_HtmlNotFound, htmlPath));
            loadingOverlay.Visibility = Visibility.Collapsed;
            webView.Visibility = Visibility.Collapsed;
            htmlNotFoundOverlay.Visibility = Visibility.Visible;
        }
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e)
    {
        // --- 1. UI setup (минимальный риск) ---
        try
        {
            try { if (System.IO.File.Exists(_logPath)) System.IO.File.Delete(_logPath); } catch { }
            Log("[Window_Loaded] START");
            UpdatePortDisplay();

            if (!CurrentGame.HasTelemetrySupport)
            {
                telemetryToggle.IsChecked = false;
                telemetryToggle.Opacity = 0.35;
                telemetryToggle.IsEnabled = false;
                udpPortInput.Opacity = 0.35;
                udpPortInput.IsHitTestVisible = false;
                udpPortInput.InputTextBox.IsEnabled = false;
                udpDataBtn.Opacity = 0.35;
                udpDataBtn.IsEnabled = false;
                udpStatusConnection.Visibility = Visibility.Collapsed;
                udpStatusMain.Visibility = Visibility.Collapsed;
            }
            else
            {
                telemetryToggle.Opacity = 1;
                telemetryToggle.IsEnabled = true;
                udpPortInput.Opacity = 1;
                udpPortInput.IsHitTestVisible = true;
                udpPortInput.InputTextBox.IsEnabled = true;
                udpDataBtn.Opacity = 1;
                udpDataBtn.IsEnabled = true;
                udpStatusConnection.Visibility = Visibility.Visible;
                udpStatusMain.Visibility = Visibility.Visible;
            }

            htmlPathField.InputTextBox.IsReadOnly = true;
            htmlPathField.InputTextBox.Cursor = Cursors.Hand;
            htmlPathField.PreviewMouseDown += HtmlPathBorder_MouseDown;

            htmlPathField.InputTextBox.SizeChanged += (_, _) =>
            {
                if (_copyTimer != null) return;
                if (!string.IsNullOrEmpty(_rawHtmlPath))
                    htmlPathField.Text = FormatDisplayPath(_rawHtmlPath);
            };

            _ = Dispatcher.BeginInvoke(new Action(() =>
            {
                _rawHtmlPath = !string.IsNullOrEmpty(_appConfig.HtmlPath)
                    ? _appConfig.HtmlPath
                    : ResolveSourcePath(System.IO.Path.Combine("Widget", "MiniRacingHUD.html"));
                htmlPathField.ToolTip = _rawHtmlPath;
                htmlPathField.Text = FormatDisplayPath(_rawHtmlPath);
            }), System.Windows.Threading.DispatcherPriority.Normal);
        }
        catch (Exception ex)
        {
            Log($"[Window_Loaded] UI setup error: {ex.Message}");
        }

        // --- 2. WebView init (критично — если упало, WebView, WS и UDP недоступны) ---
        bool webViewOk = false;
        try
        {
            var webviewCache = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "WebView2");
            var env = await CoreWebView2Environment.CreateAsync(null, webviewCache);
            await webView.EnsureCoreWebView2Async(env);

            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(args.Uri) { UseShellExecute = true });
            };
#if DEBUG
            webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
#endif
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.UserAgent = "MiniRacingHUD/1.0";
            webView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(42, 42, 42);

            webViewOk = true;
        }
        catch (Exception ex)
        {
            Log($"[Window_Loaded] WebView init error: {ex.Message}");
            UpdateStatus(string.Format(Properties.Resources.Error_WebViewNotLoaded, ex.Message));
            wsStatus.Text = "WS: —";
            wsStatus.Foreground = Brushes.Gray;
            _udpStatus = UdpStatus.Dash;
            udpStatusMain.Text = Properties.Resources.Status_UdpDash;
            udpStatusMain.Foreground = Brushes.Gray;
        }

        if (webViewOk)
        {
            // --- 3b. Events + серверы (WS, HTML) ---
            try
            {
                webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
                webView.CoreWebView2.NavigationStarting += (s, navArgs) =>
                {
                    if (navArgs.NavigationKind == CoreWebView2NavigationKind.Reload) return;
                    webView.Visibility = Visibility.Collapsed;
                    loadingOverlay.Visibility = Visibility.Visible;
                };
                webView.CoreWebView2.NavigationCompleted += (s, navArgs) =>
                {
                    if (navArgs.IsSuccess)
                    {
                        if (!_isBlankNavigation && !_startupTelemetryShown)
                        {
                            if (CurrentGame.UdpEnabled)
                                UpdateStatusTransient(string.Format(Properties.Resources.Status_TelemetryOn, CurrentGame.UdpPort));
                            else
                                UpdateStatusTransient(Properties.Resources.Status_TelemetryOff);
                        }
                        _isBlankNavigation = false;
                        var presetToLoad = CurrentGame.LinkedPreset;
                        if (string.IsNullOrEmpty(presetToLoad))
                            presetToLoad = "Default";
                        Log($"[NavigationCompleted] sending config: game='{_appConfig.SelectedGame}', linkedPreset='{presetToLoad}'");
                        var configMsg = JsonSerializer.Serialize(new
                        {
                        action = "initSession",
                        wsPort = _appConfig.WsPort,
                        selectedGame = _appConfig.SelectedGame,
                            linkedPreset = presetToLoad,
                            handbrakeInTelemetry = CurrentGame.HandbrakeInTelemetry,
                            steeringInTelemetry = CurrentGame.SteeringInTelemetry,
                            diMode = _appConfig.UseDiMode,
                            interfaceLanguage = _appConfig.Language,
                            uiTheme = _currentUiTheme
                        });
                        webView.CoreWebView2.PostWebMessageAsJson(configMsg);

                        if (!string.IsNullOrEmpty(presetToLoad))
                        {
                            var presetContent = ReadPresetFileContent(presetToLoad);
                            if (presetContent != null)
                            {
                                Log($"[NavigationCompleted] sending presetContent: preset='{presetToLoad}', {presetContent.Length} chars");
                                var contentMsg = JsonSerializer.Serialize(new { action = "presetContent", presetName = presetToLoad, content = presetContent });
                                webView.CoreWebView2.PostWebMessageAsJson(contentMsg);
                            }
                        }

                        SendPresetList();
                        LoadColors();
                        SendColorsToJs();
                        SendCustomThemeList();

                        _pageReadyFallback?.Stop();
                        _pageReadyFallback = new System.Windows.Threading.DispatcherTimer();
                        _pageReadyFallback.Interval = TimeSpan.FromSeconds(10);
                        _pageReadyFallback.Tick += (_, _) =>
                        {
                            _pageReadyFallback.Stop();
                            loadingOverlay.Visibility = Visibility.Collapsed;
                            webView.Visibility = Visibility.Visible;
                        };
                        _pageReadyFallback.Start();
                    }
                    else UpdateStatus(string.Format(Properties.Resources.Error_NavigationFailed, navArgs.WebErrorStatus));
                };

                var pageReadyScript = "window.addEventListener('load',function(){/*setTimeout(function(){*/window.chrome.webview.postMessage('{\"action\":\"pageReady\"}')/*},600)*/})";
                await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(pageReadyScript);

                ReloadHtml();
                StartWebSocket();
                StartTvdPoll();
                SendDiModeToJs(_appConfig.UseDiMode);
                Log($"[Window_Loaded] SelectedGame='{_appConfig.SelectedGame}', LinkedPreset='{CurrentGame.LinkedPreset}'");
            }
            catch (Exception ex)
            {
                Log($"[Window_Loaded] Events/servers error: {ex.Message}");
                UpdateStatus(string.Format(Properties.Resources.Error_InitFailed, ex.Message));
            }
        }

        // --- 4. Post-init (UDP, таймеры, диалог доната) ---
        try
        {
            var startPreset = CurrentGame.LinkedPreset;
            if (string.IsNullOrEmpty(startPreset))
            {
                startPreset = "Default";
                Log($"[Window_Loaded] LinkedPreset was empty, using '{startPreset}'");
            }
            Log($"[Window_Loaded] startPreset='{startPreset}', wsClients={_wsClients.Count}");
            BroadcastPresetChange(startPreset);

            CurrentGame.UdpEnabled = _appConfig.UdpEnabled;
            if (CurrentGame.UdpEnabled)
            {
                await StartUDPAsync();
            }
            else
            {
                telemetryToggle.IsChecked = false;
                _udpStatus = UdpStatus.Off;
                _udpConnStatus = "";
                udpStatusMain.Text = Properties.Resources.Status_UdpOff;
                udpStatusMain.Foreground = ThemeRes<SolidColorBrush>("OrangeBrush") ?? Brushes.Orange;
                udpStatusConnection.Text = "";
                udpStatusConnection.Foreground = ThemeRes<SolidColorBrush>("OrangeBrush") ?? Brushes.Orange;
            }

            udpPortInput.InputTextBox.LostFocus += UdpPortBox_LostFocus;
            udpPortInput.InputTextBox.KeyDown += UdpPortBox_KeyDown;

            _autoDetectTimer = new System.Windows.Threading.DispatcherTimer();
            _autoDetectTimer.Interval = TimeSpan.FromSeconds(3);
            _autoDetectTimer.Tick += AutoDetectTick;
            _autoDetectTimer.Start();

            var handle = new WindowInteropHelper(this).Handle;
            var source = HwndSource.FromHwnd(handle);
            _wndProcHook = WndProc;
            source?.AddHook(_wndProcHook);

            try
            {
                _directInputReader = new DirectInputReader(handle, msg => Log(msg));
                if (_directInputReader.HasDevices)
                {
                    Log($"[DirectInput] {_directInputReader.DeviceCount} device(s) found");
                    if (_appConfig.UseDiMode)
                    {
                        _diPollTimer = new System.Threading.Timer(
                            _ => DiPollTick(),
                            null,
                            TimeSpan.Zero,
                            TimeSpan.FromMilliseconds(16));
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"[DirectInput] Init error: {ex.Message}");
            }

            diModeToggle.IsChecked = _appConfig.UseDiMode;

            var ver = System.Reflection.Assembly.GetExecutingAssembly()
                .GetCustomAttribute<System.Reflection.AssemblyInformationalVersionAttribute>()
                ?.InformationalVersion ?? "0.0.0";
            LocalizationManager.CultureChanged += (_, _) =>
            {
                UpdateTitle(ver);
            };

            Log("[Window_Loaded] initialization complete");

            if (!_appConfig.DonationReminderShown && _appConfig.Language == "ru")
            {
                _appConfig.DonationReminderShown = true;
                SaveConfig();
                ShowDonationDialog();
            }

            _ = CheckUpdatesAsync();
        }
        catch (Exception ex)
        {
            Log($"[Window_Loaded] Post-init error: {ex.Message}");
        }
    }

    private async Task CheckUpdatesAsync()
    {
        try
        {
            await Task.Delay(3000);
            var info = await UpdateService.CheckAsync();
            if (info == null) return;
            new UpdateDialog(info, this).ShowDialog();
        }
        catch (Exception ex)
        {
            Log($"[Update] {ex.Message}");
        }
    }

    private void CoreWebView2_WebMessageReceived(object? sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var message = e.TryGetWebMessageAsString();
            if (message == null) return;
            var json = JsonSerializer.Deserialize<Dictionary<string, object>>(message);
            if (json != null && json.TryGetValue("action", out var action))
            {
                switch (action.ToString())
                {
                    case "startUDP":
                        _ = StartUDPAsync();
                        break;
                    case "stopUDP":
                        _ = StopUDPAsync();
                        break;
                    case "getStatus":
                        SendStatusToJS();
                        break;
                    case "savePreset":
                        if (json.TryGetValue("content", out var content) && content != null)
                        {
                            var filename = json.TryGetValue("filename", out var fn) ? fn?.ToString() : "Default";
                            var name = SanitizeFilename(filename!);
                            Log($"[WebMessage] savePreset: name='{name}', content length={content.ToString()?.Length}");
                            SavePreset(name, content.ToString()!);
                            BroadcastPresetChange(name);
                        }
                        break;
                    case "requestPresetList":
                        SendPresetList();
                        break;
                    case "loadConfig":
                        if (json.TryGetValue("filename", out var presetName) && presetName != null)
                            LoadPreset(SanitizeFilename(presetName.ToString()!));
                        break;
                    case "deleteConfig":
                        if (json.TryGetValue("filename", out var delName) && delName != null)
                            DeletePreset(SanitizeFilename(delName.ToString()!));
                        break;
                    case "updateGamePreset":
                        if (json.TryGetValue("presetName", out var presetVal))
                        {
                            var name = SanitizeFilename(presetVal?.ToString() ?? "");
                            Log($"[WebMessage] updateGamePreset: name='{name}'");
                            CurrentGame.LinkedPreset = name;
                            SaveConfig();
                            BroadcastPresetChange(name);
                        }
                        break;
                    case "pasteBindings":
                        try
                        {
                            var text = System.Windows.Clipboard.GetText();
                            webView.CoreWebView2.PostWebMessageAsJson(
                                JsonSerializer.Serialize(new { action = "pasteBindingsResult", data = text }));
                        }
                        catch
                        {
                            webView.CoreWebView2.PostWebMessageAsJson(
                                JsonSerializer.Serialize(new { action = "pasteBindingsResult", data = "" }));
                        }
                        break;
                    case "pageReady":
                        _pageReadyFallback?.Stop();
                        Dispatcher.Invoke(() =>
                        {
                            loadingOverlay.Visibility = Visibility.Collapsed;
                            webView.Visibility = Visibility.Visible;
                        });
                        break;
                    case "openThemeEditor":
                        Dispatcher.Invoke(() => OpenThemeEditor_Click(null!, null!));
                        break;
                    case "deleteTheme":
                        if (json.TryGetValue("name", out var themeName) && themeName != null)
                            DeleteTheme(themeName.ToString()!);
                        break;
                    case "toggleUiTheme":
                        _currentUiTheme = _currentUiTheme == "light" ? "dark" : "light";
                        _appConfig.UiTheme = _currentUiTheme;
                        SaveConfig();
                        LoadColors();
                        SendColorsToJs();
                        if (_colorEditorWindow != null)
                        {
                            _ = RefreshColorEditorDefaultsAsync();
                        }
                        break;
                    case "themeColors":
                        foreach (var kvp in _wsClients)
                            _ = Task.Run(() => { try { kvp.Value.Send(message); } catch { } });
                        break;
                    case "startKeyboardCapture":
                        StartKeyboardHook();
                        break;
                    case "stopKeyboardHook":
                        StopKeyboardHook();
                        break;
                }
            }
        }
        catch { Log("WebMessageReceived error"); }
    }

    private void SavePreset(string name, string content)
    {
        try
        {
            if (string.IsNullOrEmpty(_currentHtmlPath)) return;
            var folder = System.IO.Path.GetDirectoryName(_currentHtmlPath) ?? string.Empty;
            var presetsDir = System.IO.Path.Combine(folder, "presets");
            System.IO.Directory.CreateDirectory(presetsDir);
            var configPath = System.IO.Path.Combine(presetsDir, name + ".js");
            System.IO.File.WriteAllText(configPath, content);
        }
        catch (Exception ex)
        {
            UpdateStatus(string.Format(Properties.Resources.Error_PresetSave, ex.Message));
        }
    }

    private void SendPresetList()
    {
        try
        {
            if (string.IsNullOrEmpty(_currentHtmlPath)) return;
            var folder = System.IO.Path.GetDirectoryName(_currentHtmlPath) ?? string.Empty;
            var presetsDir = System.IO.Path.Combine(folder, "presets");
            if (!System.IO.Directory.Exists(presetsDir))
            {
                System.IO.Directory.CreateDirectory(presetsDir);
                var empty = JsonSerializer.Serialize(new { action = "presetList", configs = new string[0] });
                webView?.CoreWebView2?.PostWebMessageAsJson(empty);
                return;
            }

            var files = System.IO.Directory.GetFiles(presetsDir, "*.js")
                .Select(f => System.IO.Path.GetFileNameWithoutExtension(f))
                .ToArray();

            var msg = JsonSerializer.Serialize(new { action = "presetList", configs = files });
            webView?.CoreWebView2?.PostWebMessageAsJson(msg);
        }
        catch (Exception ex)
        {
            UpdateStatus(string.Format(Properties.Resources.Error_PresetList, ex.Message));
        }
    }

    private void LoadPreset(string name)
    {
        Log($"[LoadPreset] name='{name}'");
        try
        {
            if (string.IsNullOrEmpty(_currentHtmlPath)) return;
            var folder = System.IO.Path.GetDirectoryName(_currentHtmlPath) ?? string.Empty;
            var presetsDir = System.IO.Path.Combine(folder, "presets");
            var configPath = System.IO.Path.Combine(presetsDir, name + ".js");
            if (!System.IO.File.Exists(configPath)) { Log($"[LoadPreset] file NOT FOUND: {configPath}"); return; }

            CurrentGame.LinkedPreset = name;
            SaveConfig();
            var content = System.IO.File.ReadAllText(configPath);
            var msg = JsonSerializer.Serialize(new { action = "presetContent", presetName = name, content });
            webView?.CoreWebView2?.PostWebMessageAsJson(msg);
            BroadcastPresetChange(name);
        }
        catch (Exception ex)
        {
            UpdateStatus(string.Format(Properties.Resources.Error_PresetLoad, ex.Message));
        }
    }

    private void DeletePreset(string name)
    {
        try
        {
            if (string.IsNullOrEmpty(_currentHtmlPath)) return;
            var folder = System.IO.Path.GetDirectoryName(_currentHtmlPath) ?? string.Empty;
            var presetsDir = System.IO.Path.Combine(folder, "presets");
            var configPath = System.IO.Path.Combine(presetsDir, name + ".js");
            if (System.IO.File.Exists(configPath))
                System.IO.File.Delete(configPath);
            SendPresetList();
        }
        catch (Exception ex)
        {
            UpdateStatus(string.Format(Properties.Resources.Error_PresetDelete, ex.Message));
        }
    }

    private void DeleteTheme(string name)
    {
        try
        {
            if (_cachedBuiltInThemes.Contains(name)) return;
            var dir = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Widget", "themes");
            var filePath = System.IO.Path.Combine(dir, name.Replace(' ', '_') + ".json");
            if (System.IO.File.Exists(filePath))
                System.IO.File.Delete(filePath);
            SendCustomThemeList();
        }
        catch (Exception ex)
        {
            UpdateStatus(string.Format(Properties.Resources.Error_ThemeDelete, ex.Message));
        }
    }

    private async Task StartUDPAsync()
    {
        if (Interlocked.Exchange(ref _udpChanging, 1) == 1) return;
        try
        {
            try
            {
                await _udpLock.WaitAsync();
                try
                {
                    if (_isRunning) return;
                    if (!CurrentGame.HasTelemetrySupport) return;
                    _startupTelemetryShown = true;

                    _provider = TelemetryProviderFactory.Create(_appConfig.SelectedGame);

                    if (_provider == null)
                    {
                        UpdateStatus(string.Format(Properties.Resources.Error_NoTelemetryProvider, _appConfig.SelectedGame));
                        return;
                    }

                    bool connected = _provider.Connect();

                    _isRunning = connected;
                    _dataReceived = false;
                    _lastBroadcastSeq = 0;

                    Dispatcher.Invoke(() =>
                    {
                        telemetryToggle.IsChecked = connected;

                        if (connected)
                        {
                            _udpStatus = CurrentGame.IsSharedMemory ? UdpStatus.ShmemOn : UdpStatus.On;
                            _udpConnStatus = "disconnected";
                            udpStatusMain.Text = FormatUdpMainText();
                            udpStatusMain.Foreground = ThemeRes<SolidColorBrush>("GreenBrush") ?? Brushes.LimeGreen;
                            udpStatusConnection.Text = FormatUdpConnText();
                            udpStatusConnection.Foreground = ThemeRes<SolidColorBrush>("OrangeBrush") ?? Brushes.Orange;
                        }
                        else
                        {
                            _udpStatus = CurrentGame.IsSharedMemory ? UdpStatus.ShmemOff : UdpStatus.Err;
                            _udpConnStatus = "notrunning";
                            udpStatusMain.Text = FormatUdpMainText();
                udpStatusMain.Foreground = ThemeRes<SolidColorBrush>("OrangeBrush") ?? Brushes.Orange;
                            udpStatusConnection.Text = FormatUdpConnText();
                    udpStatusConnection.Foreground = ThemeRes<SolidColorBrush>("OrangeBrush") ?? Brushes.Orange;
                        }
                    });

                    if (connected)
                    {
                        StartBroadcastTimer();
                        UpdateStatusTransient(Properties.Resources.Status_TelemetryOnShort);
                    }

                    SendStatusToJS();
                }
                finally
                {
                    _udpLock.Release();
                }
            }
            catch (Exception ex)
            {
                Log($"StartUDPAsync error: {ex.Message}");
                await CleanupUdpStateAsync();
                Dispatcher.Invoke(() =>
                {
                    UpdateStatus(string.Format(Properties.Resources.Error_UdpGeneric, ex.Message));
                    telemetryToggle.IsChecked = false;
                    _udpStatus = UdpStatus.Err;
                    _udpConnStatus = "";
                    udpStatusMain.Text = Properties.Resources.Status_UdpErr;
                    udpStatusMain.Foreground = ThemeRes<SolidColorBrush>("RedBrush") ?? Brushes.OrangeRed;
                });
            }
        }
        finally
        {
            Interlocked.Exchange(ref _udpChanging, 0);
        }
    }

    private async Task StopUDPAsync()
    {
        if (Interlocked.Exchange(ref _udpChanging, 1) == 1) return;
        try
        {
            await CleanupUdpStateAsync();
            Dispatcher.Invoke(() =>
            {
                telemetryToggle.IsChecked = false;
                _udpConnStatus = "";
                if (CurrentGame.HasTelemetrySupport)
                {
                    _udpStatus = CurrentGame.IsSharedMemory ? UdpStatus.ShmemOff : UdpStatus.Off;
                }
                else
                {
                    _udpStatus = UdpStatus.Dash;
                }
                udpStatusMain.Text = FormatUdpMainText();
                udpStatusMain.Foreground = ThemeRes<SolidColorBrush>("OrangeBrush") ?? Brushes.Orange;
                udpStatusConnection.Text = "";
                _dataReceived = false;
            });
            UpdateStatusTransient(Properties.Resources.Status_TelemetryOffShort);
            SendStatusToJS();
        }
        finally
        {
            Interlocked.Exchange(ref _udpChanging, 0);
        }
    }

    private async Task CleanupUdpStateAsync()
    {
        await _udpLock.WaitAsync();
        try
        {
            _isRunning = false;
            _provider?.Dispose();
            _provider = null;
            StopBroadcastTimerLocked();
        }
        finally
        {
            _udpLock.Release();
        }
    }

    private void StartBroadcastTimer()
    {
        StopBroadcastTimerLocked();
        _broadcastTimer = new System.Threading.Timer(
            _ => UdpBroadcastTick(),
            null,
            TimeSpan.Zero,
            TimeSpan.FromMilliseconds(10));
    }

    private void StopBroadcastTimerLocked()
    {
        if (_broadcastTimer != null)
        {
            _broadcastTimer.Change(Timeout.Infinite, Timeout.Infinite);
            var t = _broadcastTimer;
            _broadcastTimer = null;
            Task.Run(() => { try { t.Dispose(); } catch { } });
        }
    }

    private async Task RestartUDPAsync()
    {
        await StopUDPAsync();
        await StartUDPAsync();
    }

    private void StopWebSocket()
    {
        StopTvdPoll();
        if (_wsServer == null) return;
        foreach (var kvp in _wsClients)
            kvp.Value.Close();
        _wsClients.Clear();
        _wsServer.Dispose();
        _wsServer = null;
        wsStatus.Text = Properties.Resources.Status_WsOff;
        wsStatus.Foreground = ThemeRes<SolidColorBrush>("OrangeBrush") ?? Brushes.Orange;
        clientsCount.Text = string.Format(Properties.Resources.Status_Clients, 0);
    }

    private void UdpBroadcastTick()
    {
        if (!_isRunning) return;
        if (Interlocked.Exchange(ref _broadcastTickBusy, 1) == 1) return;
        try
        {
            UdpBroadcastTickCore();
        }
        finally
        {
            Interlocked.Exchange(ref _broadcastTickBusy, 0);
        }
    }

    private void UdpBroadcastTickCore()
    {
        var provider = _provider;
        if (provider == null) return;

        var data = provider.ReadReduced();
        if (data == null || data.Count == 0)
        {
            if (_dataReceived)
            {
                _dataReceived = false;
                Dispatcher.Invoke(() =>
                {
                    _udpConnStatus = "notrunning";
                    udpStatusConnection.Text = Properties.Resources.Status_NotRunning;
                    udpStatusConnection.Foreground = ThemeRes<SolidColorBrush>("OrangeBrush") ?? Brushes.Orange;
                });
            }
            return;
        }

        if (!_dataReceived) OnFirstData();

        // Шлём только когда пришёл новый пакет: тик 10 мс просто снимает свежие данные
        var seq = provider.PacketSeq;
        if (seq != 0)
        {
            if (seq == _lastBroadcastSeq) return;
            _lastBroadcastSeq = seq;
        }

        SendToClients(data);
    }

    private void OnFirstData()
    {
        Dispatcher.Invoke(() =>
        {
            _udpConnStatus = "connected";
            udpStatusConnection.Text = Properties.Resources.Status_Connected;
            udpStatusConnection.Foreground = ThemeRes<SolidColorBrush>("GreenBrush") ?? Brushes.LimeGreen;
        });
        _dataReceived = true;
    }

    private void SendToClients(Dictionary<string, object> data)
    {
        if (_wsClients.IsEmpty) return;

        // 3 знака после запятой: JSON короче, на экране разницы нет
        _broadcastData.Clear();
        foreach (var kvp in data)
        {
            _broadcastData[kvp.Key] = kvp.Value switch
            {
                float f => MathF.Round(f, 3),
                double d => Math.Round(d, 3),
                _ => kvp.Value
            };
        }

        var json = JsonSerializer.Serialize(_broadcastData, _telemetryJsonOptions);
        foreach (var (id, client) in _wsClients)
        {
            _ = client.Send(json).ContinueWith(t =>
            {
                if (t.IsFaulted) _wsClients.TryRemove(id, out _);
            }, TaskContinuationOptions.OnlyOnFaulted);
        }
    }

    private string? ReadPresetFileContent(string name)
    {
        if (string.IsNullOrEmpty(_currentHtmlPath) || string.IsNullOrEmpty(name)) return null;
        var folder = System.IO.Path.GetDirectoryName(_currentHtmlPath) ?? string.Empty;
        var presetsDir = System.IO.Path.Combine(folder, "presets");
        var configPath = System.IO.Path.Combine(presetsDir, name + ".js");
        return System.IO.File.Exists(configPath) ? System.IO.File.ReadAllText(configPath) : null;
    }

    private async Task<string?> ReadPresetFileContentAsync(string name)
    {
        if (string.IsNullOrEmpty(_currentHtmlPath) || string.IsNullOrEmpty(name)) return null;
        var folder = System.IO.Path.GetDirectoryName(_currentHtmlPath) ?? string.Empty;
        var presetsDir = System.IO.Path.Combine(folder, "presets");
        var configPath = System.IO.Path.Combine(presetsDir, name + ".js");
        return System.IO.File.Exists(configPath) ? await System.IO.File.ReadAllTextAsync(configPath) : null;
    }

    private void BroadcastPresetChange(string presetName, string? content = null)
    {
        Log($"[BroadcastPresetChange] presetName='{presetName}', clients={_wsClients.Count}");
        if (content == null && !string.IsNullOrEmpty(presetName))
            content = ReadPresetFileContent(presetName);
        Log($"[BroadcastPresetChange] content={(content != null ? content.Length + " chars" : "null")}");
        if (content == null) return;
        var msg = JsonSerializer.Serialize(new { action = "presetContent", presetName, content });
        foreach (var kvp in _wsClients)
        {
            var c = kvp.Value;
            var id = kvp.Key;
            _ = Task.Run(() => { try { c.Send(msg); } catch { _wsClients.TryRemove(id, out _); } });
        }
    }

    private void StartTvdPoll()
    {
        if (_tvdTimer != null || _wsServer == null) return;
        _tvdTimer = new System.Threading.Timer(_ => TvdPollTick(), null, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(1));
    }

    private void StopTvdPoll()
    {
        var timer = _tvdTimer;
        _tvdTimer = null;
        timer?.Dispose();
    }

    private void TvdPollTick()
    {
        if (Interlocked.Exchange(ref _tvdTickBusy, 1) == 1) return;
        try { TvdPollCore(); }
        catch { }
        finally { Interlocked.Exchange(ref _tvdTickBusy, 0); }
    }

    private void TvdPollCore()
    {
        if (DateTime.UtcNow < _tvdRetryAfter) return;

        var ports = _tvdPort != 0
            ? new[] { _tvdPort, 20995, 20996, 20997 }
            : new[] { 20995, 20996, 20997 };

        foreach (var port in ports.Distinct())
        {
            string body;
            try
            {
                using var resp = _tvdHttp.GetAsync($"http://127.0.0.1:{port}/obs/info").GetAwaiter().GetResult();
                if (!resp.IsSuccessStatusCode) continue;
                body = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            }
            catch
            {
                continue;
            }

            _tvdPort = port;
            _tvdRetryAfter = DateTime.MinValue;

            string? result = null;
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("result", out var r) && r.ValueKind == JsonValueKind.Object
                    && r.TryGetProperty("n", out var n) && n.ValueKind == JsonValueKind.Number)
                {
                    // n пуст в свободной игре — результат TVD-этапа там не нужен
                    result = r.GetRawText();
                }
            }
            catch
            {
                return;
            }

            if (result != _lastTvdResult)
            {
                _lastTvdResult = result;
                BroadcastTvdInfo(result);
            }
            return;
        }

        _tvdPort = 0;
        _tvdRetryAfter = DateTime.UtcNow.AddSeconds(5);
        if (_lastTvdResult != null)
        {
            _lastTvdResult = null;
            BroadcastTvdInfo(null);
        }
    }

    private void BroadcastTvdInfo(string? resultJson)
    {
        var msg = "{\"action\":\"tvdInfo\",\"result\":" + (resultJson ?? "null") + "}";
        foreach (var kvp in _wsClients)
        {
            var c = kvp.Value;
            var id = kvp.Key;
            _ = Task.Run(() => { try { c.Send(msg); } catch { _wsClients.TryRemove(id, out _); } });
        }
    }

    private async void DiPollTick()
    {
        if (_directInputReader == null || !_directInputReader.HasDevices) return;
        if (Interlocked.Exchange(ref _diPollTickBusy, 1) == 1) return;

        try
        {
            var diState = await Task.Run(() => _directInputReader!.PollAll());
            if (diState.Count == 0) return;

            var msg = JsonSerializer.Serialize(new { action = "diState", devices = diState }, _diJsonOptions);

            await Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    webView?.CoreWebView2?.PostWebMessageAsJson(msg);
                }
                catch { }
            });

            foreach (var (id, client) in _wsClients)
            {
                _ = client.Send(msg).ContinueWith(t =>
                {
                    if (t.IsFaulted) _wsClients.TryRemove(id, out _);
                }, TaskContinuationOptions.OnlyOnFaulted);
            }
        }
        catch (Exception ex)
        {
            Log($"[DirectInput] Poll error: {ex.Message}");
        }
        finally
        {
            Interlocked.Exchange(ref _diPollTickBusy, 0);
        }
    }

    private void DiModeToggle_Checked(object sender, RoutedEventArgs e)
    {
        _appConfig.UseDiMode = true;
        SaveConfig();
        if (_directInputReader?.HasDevices == true && _diPollTimer == null)
        {
            _diPollTimer = new System.Threading.Timer(
                _ => DiPollTick(),
                null,
                TimeSpan.Zero,
                TimeSpan.FromMilliseconds(16));
        }
        SendDiModeToJs(true);
    }

    private void DiModeToggle_Unchecked(object sender, RoutedEventArgs e)
    {
        _appConfig.UseDiMode = false;
        SaveConfig();
        if (_diPollTimer != null)
        {
            _diPollTimer.Dispose();
            _diPollTimer = null;
        }
        SendDiModeToJs(false);
    }

    private void SendDiModeToJs(bool enabled)
    {
        var msg = JsonSerializer.Serialize(new { action = "toggleDiMode", enabled });
        try
        {
            webView?.CoreWebView2?.PostWebMessageAsJson(msg);
        }
        catch { }
        foreach (var kvp in _wsClients)
        {
            var client = kvp.Value;
            var id = kvp.Key;
            _ = Task.Run(() =>
            {
                try { client.Send(msg); }
                catch { _wsClients.TryRemove(id, out _); }
            });
        }
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        const int WM_DEVICECHANGE = 0x0219;
        const int DBT_DEVICEARRIVAL = 0x8000;
        const int DBT_DEVICEREMOVECOMPLETE = 0x8004;

        if (msg == WM_DEVICECHANGE &&
            (wParam == (IntPtr)DBT_DEVICEARRIVAL ||
             wParam == (IntPtr)DBT_DEVICEREMOVECOMPLETE))
        {
            _directInputReader?.NotifyDeviceChange();
        }
        return IntPtr.Zero;
    }

    private void StartWebSocket()
    {
        if (_wsServer != null) return;
        try
        {
            _wsServer = new Fleck.WebSocketServer($"ws://127.0.0.1:{_appConfig.WsPort}");
            _wsServer.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    _wsClients.TryAdd(socket.ConnectionInfo.Id, socket);
                    Dispatcher.Invoke(() =>
                    {
                        wsStatus.Text = Properties.Resources.Status_WsOn;
                        wsStatus.Foreground = ThemeRes<SolidColorBrush>("GreenBrush") ?? Brushes.LimeGreen;
                        clientsCount.Text = string.Format(Properties.Resources.Status_Clients, _wsClients.Count);
                    });

                    var linked = CurrentGame.LinkedPreset;
                    if (string.IsNullOrEmpty(linked)) linked = "Default";
                    if (!string.IsNullOrEmpty(linked))
                    {
                        var content = ReadPresetFileContent(linked);
                        if (content != null)
                        {
                            var presetMsg = JsonSerializer.Serialize(new { action = "presetContent", presetName = linked, content });
                            socket.Send(presetMsg);
                            Log($"[WS OnOpen] preset sent: '{linked}'");
                        }
                    }

                    var statusMsg = JsonSerializer.Serialize(new { action = "status", udp = _isRunning ? "on" : "off", ws = "on", clients = _wsClients.Count, handbrakeInTelemetry = CurrentGame.HandbrakeInTelemetry, steeringInTelemetry = CurrentGame.SteeringInTelemetry });
                    socket.Send(statusMsg);

                    if (_lastTvdResult != null)
                        socket.Send("{\"action\":\"tvdInfo\",\"result\":" + _lastTvdResult + "}");

                    socket.Send(JsonSerializer.Serialize(new { action = "tvdPreview", enabled = _tvdPreviewEnabled }));

                    // Слать текущий DI-режим новому клиенту
                    if (_appConfig.UseDiMode)
                    {
                        var diModeMsg = JsonSerializer.Serialize(new { action = "toggleDiMode", enabled = true });
                        socket.Send(diModeMsg);
                    }

                    // Слать список кастомных тем (новый клиент мог не получить при старте)
                    Dispatcher.Invoke(() => SendCustomThemeList());

                    Log($"[WS OnOpen] client connected. LinkedPreset='{CurrentGame.LinkedPreset}', SelectedGame='{_appConfig.SelectedGame}'");
                };
                socket.OnClose = () =>
                {
                    _wsClients.TryRemove(socket.ConnectionInfo.Id, out _);
                    Dispatcher.Invoke(() =>
                    {
                        clientsCount.Text = string.Format(Properties.Resources.Status_Clients, _wsClients.Count);
                    });
                };
                socket.OnMessage = message =>
                {
                    try
                    {
                        var json = JsonSerializer.Deserialize<Dictionary<string, object>>(message);
                        if (json != null && json.TryGetValue("action", out var action))
                        {
                            var actionStr = action?.ToString();
                            if (actionStr == "requestPreset")
                            {
                                var linked = CurrentGame.LinkedPreset;
                                if (string.IsNullOrEmpty(linked)) linked = "Default";
                                if (!string.IsNullOrEmpty(linked))
                                {
                                    var content = ReadPresetFileContent(linked);
                                    if (content != null)
                                    {
                                        var presetMsg = JsonSerializer.Serialize(new { action = "presetContent", presetName = linked, content });
                                        socket.Send(presetMsg);
                                        Log($"[WS OnMessage] preset sent: '{linked}' ({content.Length} chars)");
                                    }
                                }
                            }
                            else if (actionStr == "configUpdate")
                            {
                                foreach (var kvp in _wsClients)
                                {
                                    if (kvp.Key != socket.ConnectionInfo.Id)
                                    {
                                        try { kvp.Value.Send(message); } catch { _wsClients.TryRemove(kvp.Key, out _); }
                                    }
                                }
                            }
                            else if (actionStr == "themeColors")
                            {
                                // Ретранслировать цвета темы всем остальным WS-клиентам
                                foreach (var kvp in _wsClients)
                                {
                                    if (kvp.Key != socket.ConnectionInfo.Id)
                                    {
                                        try { kvp.Value.Send(message); } catch { _wsClients.TryRemove(kvp.Key, out _); }
                                    }
                                }
                            }
                            else if (actionStr == "tvdPreview")
                            {
                                var enabled = false;
                                try
                                {
                                    if (json.TryGetValue("enabled", out var enObj) && enObj is JsonElement en)
                                        enabled = en.GetBoolean();
                                }
                                catch { }
                                _tvdPreviewEnabled = enabled;
                                foreach (var kvp in _wsClients)
                                {
                                    if (kvp.Key != socket.ConnectionInfo.Id)
                                    {
                                        try { kvp.Value.Send(message); } catch { _wsClients.TryRemove(kvp.Key, out _); }
                                    }
                                }
                            }
                        }
                    }
                    catch { Log("WebSocket OnMessage error"); }
                };
            });

            wsStatus.Text = Properties.Resources.Status_WsOn;
            wsStatus.Foreground = ThemeRes<SolidColorBrush>("GreenBrush") ?? Brushes.LimeGreen;
            UpdateStatusTransient(Properties.Resources.Status_WsOn);

            try
            {
                var msg = JsonSerializer.Serialize(new { action = "wsRestart" });
                webView?.CoreWebView2?.PostWebMessageAsJson(msg);
            }
            catch { }
        }
        catch (Exception ex)
        {
            UpdateStatus(string.Format(Properties.Resources.Error_WebSocket, ex.Message));
        }
    }

    private void SendStatusToJS()
    {
        var status = new
        {
            action = "status",
            udp = _isRunning ? "on" : "off",
            ws = _wsClients.Count > 0 ? "on" : "off",
            clients = _wsClients.Count,
            handbrakeInTelemetry = CurrentGame.HandbrakeInTelemetry,
            steeringInTelemetry = CurrentGame.SteeringInTelemetry
        };
        var json = JsonSerializer.Serialize(status);
        webView?.CoreWebView2?.PostWebMessageAsJson(json);

        // Broadcast to WebSocket clients too
        foreach (var kvp in _wsClients)
        {
            var c = kvp.Value;
            var id = kvp.Key;
            _ = Task.Run(() => { try { c.Send(json); } catch { _wsClients.TryRemove(id, out _); } });
        }
    }

    private void UpdateStatus(string message)
    {
        if (statusText == null) return;
        Dispatcher.Invoke(() =>
        {
            _statusTimer?.Stop();
            statusText.Text = message;
        });
    }

    private void UpdateStatusTransient(string message)
    {
        if (statusText == null) return;
        Dispatcher.Invoke(() =>
        {
            _statusTimer?.Stop();
            statusText.Text = message;
            if (_statusTimer == null)
            {
                _statusTimer = new System.Windows.Threading.DispatcherTimer
                {
                    Interval = TimeSpan.FromSeconds(4)
                };
                _statusTimer.Tick += (s, e) =>
                {
                    _statusTimer?.Stop();
                    statusText.Text = Properties.Resources.Status_Ready;
                };
            }
            _statusTimer.Start();
        });
    }

    private void TelemetryToggle_Click(object sender, RoutedEventArgs e)
    {
        if (telemetryToggle.IsChecked == true)
        {
            _ = StartUDPAsync();
            udpPortInput.InputTextBox.IsEnabled = CurrentGame.UdpPort > 0;
            udpPortInput.Opacity = 1;
            udpPortInput.IsHitTestVisible = true;
            udpDataBtn.IsEnabled = true;
            udpDataBtn.Opacity = 1;
        }
        else
        {
            _ = StopUDPAsync();
            udpPortInput.InputTextBox.IsEnabled = false;
            udpPortInput.Opacity = 0.35;
            udpPortInput.IsHitTestVisible = false;
            udpDataBtn.IsEnabled = false;
            udpDataBtn.Opacity = 0.35;
        }
        _appConfig.UdpEnabled = telemetryToggle.IsChecked == true;
        CurrentGame.UdpEnabled = _appConfig.UdpEnabled;
        SaveConfig();
    }

    private void CloseWindow(object sender, RoutedEventArgs e)
    {
        Application.Current.Shutdown();
    }

    private void MinimizeWindow(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeWindow(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
    }

    private void TrayOpen_Click(object sender, RoutedEventArgs e)
    {
        ShowInTaskbar = true;
        WindowState = WindowState.Normal;
        Activate();
    }

    private void TrayClick_Toggle(object sender, RoutedEventArgs e)
    {
        if (WindowState == WindowState.Minimized)
        {
            ShowInTaskbar = true;
            WindowState = WindowState.Normal;
            Activate();
        }
        else if (trayToggle.IsChecked == true)
        {
            WindowState = WindowState.Minimized;
        }
    }

    private void CreateTrayIcon()
    {
        if (_trayIcon != null) return;
        _trayIcon = new Hardcodet.Wpf.TaskbarNotification.TaskbarIcon
        {
            IconSource = new System.Windows.Media.Imaging.BitmapImage(new Uri("pack://application:,,,/MiniRacingHUD.ico")),
            ToolTipText = Properties.Resources.Tray_Tooltip
        };
        _trayIcon.TrayLeftMouseDown += TrayClick_Toggle;
        var ctxMenu = new System.Windows.Controls.ContextMenu();
        ctxMenu.Items.Add(new System.Windows.Controls.MenuItem { Header = Properties.Resources.Tray_Open });
        ((System.Windows.Controls.MenuItem)ctxMenu.Items[0]).Click += TrayOpen_Click;
        ctxMenu.Items.Add(new System.Windows.Controls.MenuItem { Header = Properties.Resources.Tray_Exit });
        ((System.Windows.Controls.MenuItem)ctxMenu.Items[1]).Click += TrayExit_Click;
        _trayIcon.ContextMenu = ctxMenu;
    }

    private void DestroyTrayIcon()
    {
        if (_trayIcon == null) return;
        if (WindowState == WindowState.Minimized && ShowInTaskbar == false)
        {
            ShowInTaskbar = true;
            WindowState = WindowState.Normal;
        }
        _trayIcon.Dispose();
        _trayIcon = null;
    }

    private void TrayToggle_Checked(object sender, RoutedEventArgs e)
    {
        CreateTrayIcon();
        _appConfig.MinimizeToTray = true;
        SaveConfig();
    }

    private void TrayToggle_Unchecked(object sender, RoutedEventArgs e)
    {
        DestroyTrayIcon();
        _appConfig.MinimizeToTray = false;
        SaveConfig();
    }

    private void TrayExit_Click(object sender, RoutedEventArgs e)
    {
        _trayIcon?.Dispose();
        Application.Current.Shutdown();
    }

    private void CopyHtmlPathWithFeedback()
    {
        var fileUri = new Uri(_rawHtmlPath).AbsoluteUri;
        if (_appConfig.WsPort != 20888)
            fileUri += $"?wsport={_appConfig.WsPort}";
        try { Clipboard.SetText(fileUri); } catch { Log("Clipboard error"); }

        var originalText = htmlPathField.Text;

        _copyTimer?.Stop();

        var accent = ThemeRes<SolidColorBrush>("AccentBrush") ?? new(Color.FromRgb(0x97, 0xDD, 0x7A));
        htmlPathField.Text = Properties.Resources.Status_Copied;
        htmlPathField.InputTextBox.Foreground = accent;

        _copyTimer = new System.Windows.Threading.DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(1200)
        };
        _copyTimer.Tick += (s, _) =>
        {
            htmlPathField.Text = originalText;
            htmlPathField.InputTextBox.ClearValue(TextBox.ForegroundProperty);
            var t = s as System.Windows.Threading.DispatcherTimer;
            if (t == null) return;
            t.Stop();
            if (_copyTimer == t) _copyTimer = null;
        };
        _copyTimer.Start();
    }

    private void HtmlPathBorder_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left) return;
        BrowseHtmlPath_Click(sender, new RoutedEventArgs());
    }

    private void HtmlPathCopy_Click(object sender, RoutedEventArgs e)
    {
        CopyHtmlPathWithFeedback();
    }

    private void CopyPathBtn_Click(object sender, RoutedEventArgs e)
    {
        CopyHtmlPathWithFeedback();
    }

    private void HtmlPathDefault_Click(object sender, RoutedEventArgs e)
    {
        _appConfig.HtmlPath = null;
        _rawHtmlPath = ResolveSourcePath(System.IO.Path.Combine("Widget", "MiniRacingHUD.html"));
        htmlPathField.ToolTip = _rawHtmlPath;
        htmlPathField.Text = FormatDisplayPath(_rawHtmlPath);
        SaveConfig();
        ReloadHtml();
    }

    private void BrowseHtmlPath_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.OpenFileDialog
        {
            Filter = Properties.Resources.Filter_HtmlFiles
        };

        if (!string.IsNullOrEmpty(_appConfig.HtmlPath))
        {
            var dir = System.IO.Path.GetDirectoryName(_appConfig.HtmlPath);
            if (!string.IsNullOrEmpty(dir)) dialog.InitialDirectory = dir;
            dialog.FileName = System.IO.Path.GetFileName(_appConfig.HtmlPath);
        }

        if (dialog.ShowDialog() == true)
        {
            _appConfig.HtmlPath = dialog.FileName;
            _rawHtmlPath = dialog.FileName;
            htmlPathField.ToolTip = _rawHtmlPath;
            htmlPathField.Text = FormatDisplayPath(_rawHtmlPath);
            SaveConfig();
            ReloadHtml();
        }
    }

    private void HtmlNotFoundOverlay_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left) return;
        BrowseHtmlPath_Click(sender, new RoutedEventArgs());
    }

    private static T? ThemeRes<T>(string key) where T : class =>
        Application.Current.Resources[key] as T;

    private void ShowUDPData_Click(object sender, RoutedEventArgs e)
    {
        if (_udpDataWindow != null)
        {
            _udpDataWindow.Close();
            return;
        }

        try
        {
            var win = new TelemetryWindow(
                provider: _provider,
                getSelectedGame: () => _appConfig.SelectedGame,
                geometryPath: _windowGeometryPath
            );
            win.Owner = this;
            win.Closed += (_, _) => _udpDataWindow = null;
            _udpDataWindow = win;
            win.Show();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, Properties.Resources.Dialog_UdpDataError, MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void RefreshPage_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentHtmlPath))
            ReloadHtml();
        else
            UpdateStatus(Properties.Resources.Error_NoHtmlPath);
    }

    private static string SanitizeFilename(string name)
    {
        var safe = System.IO.Path.GetFileName(name);
        if (string.IsNullOrEmpty(safe)) return "Config";
        var invalid = System.IO.Path.GetInvalidFileNameChars();
        safe = string.Concat(safe.Where(ch => !invalid.Contains(ch)));
        return string.IsNullOrEmpty(safe) ? "Config" : safe;
    }

    private static string SanitizePresetName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "Default";
        var safe = System.IO.Path.GetFileName(name.Trim());
        var invalid = System.IO.Path.GetInvalidFileNameChars();
        safe = string.Concat(safe.Where(ch => !invalid.Contains(ch)));
        safe = Regex.Replace(safe, @"[^a-zA-Zа-яА-ЯёЁ0-9 _\-]", "_");
        return string.IsNullOrWhiteSpace(safe) ? "Default" : safe;
    }

    private void UpdatePortDisplay()
    {
        bool isShmem = CurrentGame.IsSharedMemory;
        udpPortInput.Label = isShmem ? Properties.Resources.Status_UdpPortLabel_SharedMemory : Properties.Resources.Status_UdpPortLabel_Udp;
        udpPortInput.LabelCursor = isShmem ? Cursors.Arrow : Cursors.Hand;
        udpPortInput.LabelMargin = isShmem ? new Thickness(0) : new Thickness(0, 0, 4, 0);
        udpPortInput.InputTextBox.Visibility = isShmem ? Visibility.Collapsed : Visibility.Visible;
        udpPortInput.Text = CurrentGame.UdpPort > 0 ? CurrentGame.UdpPort.ToString() : "—";
        udpPortInput.InputTextBox.IsEnabled = CurrentGame.UdpPort > 0;
    }

    private void SaveUdpPort()
    {
        try
        {
            if (CurrentGame.UdpPort == 0) return;

            if (!int.TryParse(udpPortInput.Text, out int udpPort) || udpPort < 1024 || udpPort > 65535)
            {
                UpdateStatus(Properties.Resources.Error_PortRange);
                return;
            }

            if (CurrentGame.UdpPort == udpPort) return;

            CurrentGame.UdpPort = udpPort;
            SaveConfig();

            if (telemetryToggle.IsChecked == true)
            {
                _ = RestartUDPAsync();
            }

            UpdateStatusTransient(string.Format(Properties.Resources.Status_PortChanged, udpPort));
        }
        catch (Exception ex)
        {
            UpdateStatus(string.Format(Properties.Resources.Error_PortSave, ex.Message));
        }
    }

    private void UdpPortBox_LostFocus(object sender, RoutedEventArgs e)
    {
        SaveUdpPort();
    }

    private void UdpPortBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            SaveUdpPort();
            e.Handled = true;
            FocusManager.SetFocusedElement(this, null);
            Keyboard.ClearFocus();
        }
    }

    private void Window_PreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        if (udpPortInput.InputTextBox.IsFocused && e.OriginalSource != udpPortInput.InputTextBox)
        {
            FocusManager.SetFocusedElement(this, null);
            Keyboard.ClearFocus();
        }
    }

    private async void AutoDetectTick(object? sender, EventArgs e)
    {
        if (autoDetectToggle.IsChecked != true) return;
        if (Interlocked.Exchange(ref _autoDetectBusy, 1) == 1) return;

        Log("[AutoDetect] tick start");

        try
        {
            var detectedGames = await Task.Run(() =>
            {
                var dict = new Dictionary<string, DateTime>();
                foreach (var cfg in _appConfig.GameConfigs)
                {
                    if (string.IsNullOrEmpty(cfg.ProcessName)) continue;
                    foreach (var proc in System.Diagnostics.Process.GetProcessesByName(cfg.ProcessName))
                    {
                        try { dict[cfg.Name] = proc.StartTime; } catch { }
                        proc.Dispose();
                    }
                }
                // AMS2 может запускаться как ams2avx
                foreach (var proc in System.Diagnostics.Process.GetProcessesByName("ams2avx"))
                {
                    try { dict["Automobilista 2"] = proc.StartTime; } catch { }
                    proc.Dispose();
                }
                // BeamNG.drive может запускаться без ".x64"
                foreach (var proc in System.Diagnostics.Process.GetProcessesByName("BeamNG.drive"))
                {
                    try { dict["BeamNG.drive"] = proc.StartTime; } catch { }
                    proc.Dispose();
                }
                return dict;
            });

            if (detectedGames.Count == 0) { Log("[AutoDetect] no games detected"); return; }

            var latestGame = detectedGames.Where(kv => kv.Key != AppConfig.NoTelemetryName)
                .OrderByDescending(kv => kv.Value).FirstOrDefault().Key;
            if (latestGame == null) { Log("[AutoDetect] null latestGame"); return; }

            Log($"[AutoDetect] latestGame='{latestGame}', current='{_appConfig.SelectedGame}'");

            if (latestGame != _appConfig.SelectedGame)
            {
                Log($"[AutoDetect] switching to '{latestGame}'");
                await SwitchGameAsync(latestGame, fromAutoDetect: true);
            }
            else
            {
                Log("[AutoDetect] current game still active");
            }

            Log("[AutoDetect] tick done");
        }
        catch (Exception ex) { Log($"AutoDetectTick error: {ex.Message}"); }
        finally { Interlocked.Exchange(ref _autoDetectBusy, 0); }
    }

    private async Task SwitchGameAsync(string newGame, bool fromAutoDetect = false)
    {
        try
        {
            if (fromAutoDetect)
            {
                _isAutoDetecting = true;
                _appConfig.SelectedGame = newGame;
                gameSelector.SelectedIndex = _appConfig.GameConfigs.FindIndex(g => g.Name == newGame);
                _isAutoDetecting = false;
            }
            else
            {
                _appConfig.SelectedGame = newGame;
            }

            UpdatePortDisplay();

            bool wasRunning = _isRunning;

            if (CurrentGame.HasTelemetrySupport)
            {
                Dispatcher.Invoke(() =>
                {
                    telemetryToggle.Opacity = 1;
                    telemetryToggle.IsEnabled = true;
                    udpPortInput.Opacity = 1;
                    udpPortInput.IsHitTestVisible = true;
                    udpPortInput.InputTextBox.IsEnabled = CurrentGame.UdpPort > 0;
                    udpDataBtn.Opacity = 1;
                    udpDataBtn.IsEnabled = true;
                    udpStatusConnection.Visibility = Visibility.Visible;
                    udpStatusMain.Visibility = Visibility.Visible;
                });
            }
            else
            {
                Dispatcher.Invoke(() =>
                {
                    telemetryToggle.IsChecked = false;
                    telemetryToggle.Opacity = 0.35;
                    telemetryToggle.IsEnabled = false;
                    udpPortInput.Opacity = 0.35;
                    udpPortInput.IsHitTestVisible = false;
                    udpPortInput.InputTextBox.IsEnabled = false;
                    udpDataBtn.Opacity = 0.35;
                    udpDataBtn.IsEnabled = false;
                    udpStatusConnection.Visibility = Visibility.Collapsed;
                    udpStatusMain.Visibility = Visibility.Collapsed;
                });
            }

            if (wasRunning) await StopUDPAsync();

            if (CurrentGame.HasTelemetrySupport)
            {
                await StartUDPAsync();
            }

            // Сохраняем конфиг только при ручном переключении
            if (!fromAutoDetect)
            {
                await SaveConfigAsync();
            }

            var presetName = CurrentGame.LinkedPreset;
            if (string.IsNullOrEmpty(presetName)) presetName = "Default";

            var msg = JsonSerializer.Serialize(new { action = "gameChange", selectedGame = _appConfig.SelectedGame, linkedPreset = presetName, handbrakeInTelemetry = CurrentGame.HandbrakeInTelemetry, steeringInTelemetry = CurrentGame.SteeringInTelemetry });
            webView?.CoreWebView2?.PostWebMessageAsJson(msg);

            var presetContent = await ReadPresetFileContentAsync(presetName);
            if (presetContent != null)
            {
                var ccMsg = JsonSerializer.Serialize(new { action = "presetContent", presetName = presetName, content = presetContent });
                webView?.CoreWebView2?.PostWebMessageAsJson(ccMsg);
            }

            BroadcastPresetChange(presetName, presetContent);

            Log($"[{(fromAutoDetect ? "AutoDetect" : "GameSelector")}] new game='{_appConfig.SelectedGame}', preset='{presetName}'");
        }
        catch (Exception ex)
        {
            Log($"SwitchGameAsync error: {ex.Message}");
        }
    }

    private async void GameSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_isAutoDetecting) return;
        var selectedItem = gameSelector.SelectedItem as GameSelectorItem;
        if (selectedItem == null) return;
        if (selectedItem.IsSeparator)
        {
            gameSelector.SelectedIndex = _appConfig.GameConfigs.FindIndex(g => g.Name == _appConfig.SelectedGame);
            return;
        }
        if (selectedItem.IsAction)
        {
            var prevGame = _appConfig.SelectedGame;
            if (!await AddNewGame())
            {
                var items = gameSelector.ItemsSource as List<GameSelectorItem>;
                gameSelector.SelectedIndex = items?.FindIndex(i => i.Name == prevGame) ?? -1;
            }
            return;
        }
        await SwitchGameAsync(selectedItem.Name, fromAutoDetect: false);
    }

    private async Task<bool> AddNewGame()
    {
        var dialog = new Microsoft.Win32.OpenFileDialog
        {
            Filter = Properties.Resources.Filter_ExecutableFiles,
            Title = Properties.Resources.Dialog_SelectExecutable
        };

        if (dialog.ShowDialog() != true) return false;

        var exeName = System.IO.Path.GetFileNameWithoutExtension(dialog.FileName);

        var nameDialog = new AddGameDialog(exeName, this);
        if (nameDialog.ShowDialog() != true) return false;

        var gameName = nameDialog.GameName;
        if (string.IsNullOrEmpty(gameName)) gameName = exeName;

        var presetName = SanitizePresetName(gameName);

        // Создать пресет на основе текущего конфига
        var currentPresetContent = await ReadPresetFileContentAsync(CurrentGame.LinkedPreset);
        if (string.IsNullOrEmpty(currentPresetContent))
        {
            currentPresetContent = await ReadPresetFileContentAsync("Default");
        }

        if (!string.IsNullOrEmpty(currentPresetContent))
        {
            SavePreset(presetName, currentPresetContent);
        }

        var newGame = new GameUdpConfig
        {
            Name = gameName,
            ProcessName = exeName,
            UdpPort = 0,
            UdpEnabled = false,
            HasTelemetrySupport = false,
            LinkedPreset = presetName
        };

        _appConfig.CustomGameConfigs.Add(newGame);
        _appConfig.SelectedGame = gameName;
        SaveConfig();
        InitGameSelector();
        var items = gameSelector.ItemsSource as List<GameSelectorItem>;
        gameSelector.SelectedIndex = items?.FindIndex(i => i.Name == gameName) ?? -1;
        return true;
    }

    private bool ShowConfirmDialog(string message)
    {
        var surfaceBrush = ThemeRes<SolidColorBrush>("SurfaceBrush") ?? new(Color.FromRgb(0x0C, 0x1A, 0x1F));
        var borderBrush  = ThemeRes<SolidColorBrush>("BorderBrush")  ?? new(Color.FromRgb(0x30, 0x3A, 0x45));
        var textPrimary  = ThemeRes<SolidColorBrush>("TextPrimaryBrush") ?? new(Color.FromRgb(0xBB, 0xBB, 0xBB));

        var win = new Window
        {
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            Background = Brushes.Transparent,
            BorderBrush = Brushes.Transparent,
            BorderThickness = new Thickness(0),
            MinWidth = 300,
            SizeToContent = SizeToContent.WidthAndHeight,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            ShowInTaskbar = false,
            Topmost = true
        };

        var closeBtnStyle = FindResource("CloseButton") as Style;

        var titleBar = new Border { Background = surfaceBrush, BorderBrush = borderBrush, BorderThickness = new Thickness(0, 0, 0, 1), Height = 36 };
        var titleGrid = new Grid();
        titleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        titleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        titleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var titleStack = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(12, 0, 16, 0) };
        titleStack.Children.Add(new System.Windows.Shapes.Ellipse { Width = 6, Height = 6, Fill = FindResource("AccentBrush") as SolidColorBrush ?? new(Color.FromRgb(0x97, 0xDD, 0x7A)), Margin = new Thickness(0, 0, 8, 0) });
        titleStack.Children.Add(new TextBlock { Text = Properties.Resources.Dialog_ConfirmTitle, FontSize = 11, FontWeight = FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center, Foreground = textPrimary });
        titleGrid.Children.Add(titleStack);

        var closeTitleBtn = new Button { Content = "✕", Width = 46, Height = double.NaN, VerticalAlignment = VerticalAlignment.Stretch, Style = closeBtnStyle };
        closeTitleBtn.Click += (_, _) => { win.DialogResult = false; win.Close(); };
        Grid.SetColumn(closeTitleBtn, 2);
        titleGrid.Children.Add(closeTitleBtn);

        titleBar.Child = titleGrid;
        titleBar.MouseLeftButtonDown += (_, args) => { if (args.ButtonState == MouseButtonState.Pressed) win.DragMove(); };

        var msgBlock = new TextBlock
        {
            Text = message,
            FontSize = 13,
            Foreground = Brushes.LightGray,
            TextWrapping = TextWrapping.Wrap,
            MaxWidth = 440,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 20)
        };

        var okBtn = new Button { Content = Properties.Resources.Dialog_ButtonYes, Style = FindResource("GreenButton") as Style, Width = 100, Height = 32 };
        var cancelBtn = new Button { Content = Properties.Resources.Dialog_ButtonCancel, Style = FindResource("GrayButton") as Style, Width = 100, Height = 32 };
        okBtn.Click += (_, _) => { win.DialogResult = true; win.Close(); };
        cancelBtn.Click += (_, _) => { win.DialogResult = false; win.Close(); };

        var btnPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        btnPanel.Children.Add(okBtn);
        btnPanel.Children.Add(new Border { Width = 16 });
        btnPanel.Children.Add(cancelBtn);

        var contentPanel = new StackPanel { Margin = new Thickness(32) };
        contentPanel.Children.Add(msgBlock);
        contentPanel.Children.Add(btnPanel);

        var rootGrid = new Grid();
        rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(36) });
        rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        rootGrid.Children.Add(titleBar);
        Grid.SetRow(titleBar, 0);

        var bodyBorder = new Border { Child = contentPanel, Background = surfaceBrush };
        Grid.SetRow(bodyBorder, 1);
        rootGrid.Children.Add(bodyBorder);

        var outerBorder = new Border { CornerRadius = new CornerRadius(8), Background = surfaceBrush, BorderBrush = borderBrush, BorderThickness = new Thickness(1), Child = rootGrid };
        outerBorder.SizeChanged += (_, _) => { outerBorder.Clip = new RectangleGeometry(new Rect(0, 0, outerBorder.ActualWidth, outerBorder.ActualHeight), 8, 8); };
        win.Content = outerBorder;
        win.PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Key.Enter) { e.Handled = true; win.DialogResult = true; win.Close(); }
            if (e.Key == Key.Escape) { e.Handled = true; win.DialogResult = false; win.Close(); }
        };
        return win.ShowDialog() == true;
    }

    private void DeleteGame(GameSelectorItem item)
    {
        var name = item.Name;
        var idx = _appConfig.CustomGameConfigs.FindIndex(g => g.Name == name);
        if (idx < 0) return;
        if (!ShowConfirmDialog(string.Format(Properties.Resources.Dialog_ConfirmDeleteGame, name)))
            return;

        _appConfig.CustomGameConfigs.RemoveAt(idx);

        if (_appConfig.SelectedGame == name)
        {
            var allGames = _appConfig.GameConfigs;
            _appConfig.SelectedGame = allGames.FirstOrDefault(g => g.Name != name)?.Name
                ?? AppConfig.NoTelemetryName;
        }

        SaveConfig();
        InitGameSelector();
    }

    private void ShowDonationDialog()
    {
        var win = new Window();
        win.Title = Properties.Resources.Dialog_DonationTitle;

        var surfaceBrush = ThemeRes<SolidColorBrush>("SurfaceBrush") ?? new(Color.FromRgb(0x0C, 0x1A, 0x1F));
        var borderBrush  = ThemeRes<SolidColorBrush>("BorderBrush")  ?? new(Color.FromRgb(0x30, 0x3A, 0x45));
        var textPrimary  = ThemeRes<SolidColorBrush>("TextPrimaryBrush") ?? new(Color.FromRgb(0xBB, 0xBB, 0xBB));

        win.WindowStyle = WindowStyle.None;
        win.ResizeMode = ResizeMode.NoResize;
        win.Background = Brushes.Transparent;
        win.BorderBrush = Brushes.Transparent;
        win.BorderThickness = new Thickness(0);
        win.MinWidth = 300;
        win.SizeToContent = SizeToContent.WidthAndHeight;
        win.WindowStartupLocation = WindowStartupLocation.CenterOwner;
        win.Owner = this;
        win.ShowInTaskbar = false;
        win.Topmost = true;

        var outerBorder = new Border
        {
            CornerRadius = new CornerRadius(8),
            Background = surfaceBrush,
            BorderBrush = borderBrush,
            BorderThickness = new Thickness(1),
        };
        outerBorder.SizeChanged += (_, _) =>
        {
            outerBorder.Clip = new RectangleGeometry(
                new Rect(0, 0, outerBorder.ActualWidth, outerBorder.ActualHeight), 8, 8);
        };

        var rootGrid = new Grid();
        rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(36) });
        rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

        var titleBar = new Border
        {
            Background = surfaceBrush,
            BorderBrush = borderBrush,
            BorderThickness = new Thickness(0, 0, 0, 1),
        };

        var titleGrid = new Grid();
        titleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        titleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        titleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var titleStack = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(12, 0, 16, 0)
        };
        titleStack.Children.Add(new System.Windows.Shapes.Ellipse
        {
            Width = 6, Height = 6,
            Fill = ThemeRes<SolidColorBrush>("AccentBrush") ?? new(Color.FromRgb(0x97, 0xDD, 0x7A)),
            Margin = new Thickness(0, 0, 8, 0)
        });
        titleStack.Children.Add(new TextBlock
        {
            Text = Properties.Resources.Dialog_DonationTitle,
            FontSize = 11,
            FontWeight = FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
            Foreground = textPrimary
        });
        Grid.SetColumnSpan(titleStack, 2);
        titleGrid.Children.Add(titleStack);

        var closeStyle = Application.Current.TryFindResource("CloseButton") as Style;
        var closeBtn = new Button
        {
            Content = "✕",
            Width = 46,
            Height = double.NaN,
            VerticalAlignment = VerticalAlignment.Stretch,
            Style = closeStyle,
        };
        closeBtn.Click += (_, _) => win.Close();
        Grid.SetColumn(closeBtn, 2);
        titleGrid.Children.Add(closeBtn);

        titleBar.Child = titleGrid;
        titleBar.MouseLeftButtonDown += (_, args) =>
        {
            if (args.ButtonState == MouseButtonState.Pressed) win.DragMove();
        };
        Grid.SetRow(titleBar, 0);
        rootGrid.Children.Add(titleBar);

        var contentPanel = new StackPanel { Margin = new Thickness(32) };
        var splashTb = new TextBlock
        {
            FontSize = 13,
            Foreground = Brushes.LightGray,
            TextWrapping = TextWrapping.Wrap,
            MaxWidth = 440,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 20)
        };
        splashTb.Inlines.Add(Properties.Resources.Dialog_DonationBody);
        var accentBrush = new SolidColorBrush(Color.FromRgb(0x97, 0xDD, 0x7A));
        var accentBrightBrush = new SolidColorBrush(Color.FromRgb(0xA8, 0xE8, 0x8B));
        var link = new Hyperlink(new Run(Properties.Resources.Dialog_DonationLink))
        {
            NavigateUri = new Uri("https://live.vkvideo.ru/syber1an"),
            Foreground = accentBrush,
            TextDecorations = null,
            ToolTip = "https://live.vkvideo.ru/syber1an"
        };
        link.RequestNavigate += (_, e) =>
            Process.Start(new ProcessStartInfo(e.Uri.AbsoluteUri) { UseShellExecute = true });
        link.MouseEnter += (_, _) => link.Foreground = accentBrightBrush;
        link.MouseLeave += (_, _) => link.Foreground = accentBrush;
        splashTb.Inlines.Add(link);
        splashTb.Inlines.Add(new Run(Properties.Resources.Dialog_DonationPostscript));
        contentPanel.Children.Add(splashTb);

        var donateCloseBtn = new Button
        {
            Content = Properties.Resources.Dialog_DonationClose,
            Width = 120,
            Height = 32,
            HorizontalAlignment = HorizontalAlignment.Center,
            Style = FindResource("GreenButton") as Style
        };
        donateCloseBtn.Click += (_, _) => win.Close();
        contentPanel.Children.Add(donateCloseBtn);

        Grid.SetRow(contentPanel, 1);
        rootGrid.Children.Add(contentPanel);

        outerBorder.Child = rootGrid;
        win.Content = outerBorder;
        win.PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Key.Enter) { e.Handled = true; win.Close(); }
            if (e.Key == Key.Escape) { e.Handled = true; win.Close(); }
        };

        win.ShowDialog();
    }

    private void InitLanguageSelector()
    {
        var items = new List<GameSelectorItem>
        {
            new() { Name = "Русский" },
            new() { Name = "English" }
        };
        langSelector.ItemsSource = items;
        langSelector.SelectedIndex = _appConfig.Language == "en" ? 1 : 0;
        langSelector.SelectionChanged += (_, _) =>
        {
            var selectedItem = langSelector.SelectedItem as GameSelectorItem;
            if (selectedItem == null) return;
            var newLang = selectedItem.Name == "English" ? "en" : "ru";
            if (newLang == _appConfig.Language) return;
            _appConfig.Language = newLang;
            SaveConfig();

            var culture = newLang == "en"
                ? new System.Globalization.CultureInfo("en-US")
                : new System.Globalization.CultureInfo("ru-RU");
            LocalizationManager.ChangeCulture(culture);
        };
    }

    private void UpdateTitle(string ver)
    {
        var title = string.Format(Properties.Resources.WindowTitle_MainWithVersion, ver);
        Title = title;
        titleText.Text = title;
    }

    private string FormatUdpMainText()
    {
        return _udpStatus switch
        {
            UdpStatus.On => string.Format(Properties.Resources.Status_UdpOn, CurrentGame.UdpPort),
            UdpStatus.ShmemOn => Properties.Resources.Status_SharedMemoryOn,
            UdpStatus.ShmemOff => Properties.Resources.Status_ShmemOff,
            UdpStatus.Err => Properties.Resources.Status_UdpErr,
            UdpStatus.Off => Properties.Resources.Status_UdpOff,
            UdpStatus.Dash => Properties.Resources.Status_UdpDash,
            _ => Properties.Resources.Status_UdpDash
        };
    }

    private string FormatUdpConnText()
    {
        return _udpConnStatus switch
        {
            "connected" => Properties.Resources.Status_Connected,
            "disconnected" => Properties.Resources.Status_Disconnected,
            "notrunning" => Properties.Resources.Status_NotRunning,
            _ => ""
        };
    }

    private void UpdateStatusTexts()
    {
        maximizeBtn.ToolTip = WindowState == WindowState.Maximized
            ? Properties.Resources.Tooltip_RestoreDown
            : Properties.Resources.Tooltip_Maximize;

        udpStatusMain.Text = FormatUdpMainText();
        udpStatusConnection.Text = FormatUdpConnText();

        wsStatus.Text = _wsServer != null
            ? Properties.Resources.Status_WsOn
            : Properties.Resources.Status_WsOff;

        clientsCount.Text = string.Format(Properties.Resources.Status_Clients, _wsClients.Count);
    }

    // --- Keyboard hook ---

    private void StartKeyboardHook()
    {
        if (_keyboardHook?.IsRunning == true) return;
        if (_keyboardHook == null)
        {
            _keyboardHook = new KeyboardHook();
            _keyboardHook.KeyStateChanged += OnKeyboardKeyState;
        }
        _keyboardHook.Start();
    }

    private void StopKeyboardHook()
    {
        if (_keyboardHook != null)
        {
            _keyboardHook.KeyStateChanged -= OnKeyboardKeyState;
            _keyboardHook.Stop();
            _keyboardHook.Dispose();
            _keyboardHook = null;
        }
    }

    private void OnKeyboardKeyState(int vkCode, bool pressed)
    {
        var key = VkCodeToKey(vkCode);
        if (key == null) return;
        var json = System.Text.Json.JsonSerializer.Serialize(new { action = "keyState", key, pressed });
        foreach (var kvp in _wsClients)
            _ = Task.Run(() => { try { kvp.Value.Send(json); } catch { } });
    }

    private static string? VkCodeToKey(int vk)
    {
        if (vk >= 0x41 && vk <= 0x5A) return "Key" + (char)('A' + (vk - 0x41));
        if (vk >= 0x30 && vk <= 0x39) return "Digit" + (char)('0' + (vk - 0x30));
        if (vk >= 0x60 && vk <= 0x69) return "Numpad" + (vk - 0x60);
        if (vk >= 0x70 && vk <= 0x7B) return "F" + (vk - 0x6F);
        return vk switch
        {
            0x20 => "Space",
            0x0D => "Enter",
            0x1B => "Escape",
            0xA0 => "ShiftLeft",
            0xA1 => "ShiftRight",
            0xA2 => "ControlLeft",
            0xA3 => "ControlRight",
            0xA4 => "AltLeft",
            0xA5 => "AltRight",
            0x5B => "MetaLeft",
            0x5C => "MetaRight",
            0xC0 => "Backquote",
            0xDC => "Backslash",
            0x08 => "Backspace",
            0x14 => "CapsLock",
            0xDB => "BracketLeft",
            0xDD => "BracketRight",
            0x21 => "PageUp",
            0x22 => "PageDown",
            0x24 => "Home",
            0x23 => "End",
            0x2E => "Delete",
            0x2D => "Insert",
            0x09 => "Tab",
            0xBD => "Minus",
            0xBB => "Equal",
            0xBC => "Comma",
            0xBE => "Period",
            0xBF => "Slash",
            0xBA => "Semicolon",
            0xDE => "Quote",
            0x6A => "NumpadMultiply",
            0x6B => "NumpadAdd",
            0x6D => "NumpadSubtract",
            0x6E => "NumpadDecimal",
            0x6F => "NumpadDivide",
            _ => null
        };
    }
}
