using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Shell;

namespace MiniRacingHUD;

public partial class BaseDialogWindow : UserControl
{
    public BaseDialogWindow()
    {
        InitializeComponent();

        titleBar.MouseLeftButtonDown += (_, e) =>
        {
            if (e.ButtonState != MouseButtonState.Pressed) return;
            var pos = e.GetPosition(closeBtn);
            if (pos.X >= 0 && pos.Y >= 0 &&
                pos.X <= closeBtn.ActualWidth && pos.Y <= closeBtn.ActualHeight)
                return;
            Window.GetWindow(this)?.DragMove();
        };
    }

    public string Title
    {
        get => (string)GetValue(TitleProperty);
        set => SetValue(TitleProperty, value);
    }
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(BaseDialogWindow),
            new PropertyMetadata("Dialog", OnTitleChanged));

    private static void OnTitleChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var ctrl = (BaseDialogWindow)d;
        ctrl.titleText.Text = (string)e.NewValue;
    }

    public UIElement? BodyContent
    {
        get => contentArea.Content as UIElement;
        set => contentArea.Content = value;
    }

    public static void SetupWindow(Window win, string? geometryPath = null, string? geometryKey = null)
    {
        bool geometryLoaded = false;

        if (geometryPath != null && geometryKey != null)
        {
            var geo = LoadGeometryRaw(geometryPath, geometryKey);
            if (geo != null)
            {
                win.Left = geo.Left;
                win.Top = geo.Top;
                win.WindowStartupLocation = WindowStartupLocation.Manual;
                geometryLoaded = true;
            }
        }

        if (!geometryLoaded)
        {
            win.WindowStartupLocation = win.Owner != null
                ? WindowStartupLocation.CenterOwner
                : WindowStartupLocation.CenterScreen;
        }

        win.ResizeMode = ResizeMode.NoResize;
        win.WindowStyle = WindowStyle.SingleBorderWindow;
        WindowChrome.SetWindowChrome(win, new WindowChrome
        {
            CaptionHeight = 0
        });

        win.SourceInitialized += (_, _) =>
        {
            win.SizeToContent = SizeToContent.Width;
            win.UpdateLayout();
            win.SizeToContent = SizeToContent.Height;
            win.UpdateLayout();
            win.SizeToContent = SizeToContent.Manual;

            if (!geometryLoaded)
            {
                if (win.Owner != null)
                {
                    win.Left = win.Owner.Left + (win.Owner.Width - win.ActualWidth) / 2;
                    win.Top = win.Owner.Top + (win.Owner.Height - win.ActualHeight) / 2;
                }
                else
                {
                    win.Left = (SystemParameters.WorkArea.Width - win.ActualWidth) / 2;
                    win.Top = (SystemParameters.WorkArea.Height - win.ActualHeight) / 2;
                }
            }
        };
    }

    private static WindowSite? LoadGeometryRaw(string geometryPath, string key)
    {
        try
        {
            if (!File.Exists(geometryPath)) return null;
            var json = File.ReadAllText(geometryPath);
            var geo = JsonSerializer.Deserialize<WindowGeometry>(json);
            if (geo == null) return null;
            return GetSite(geo, key);
        }
        catch { return null; }
    }

    private static WindowSite? GetSite(WindowGeometry geo, string key) => key switch
    {
        "Main" => geo.Main,
        "Telemetry" => geo.Telemetry,
        "ColorEditor" => geo.ColorEditor,
        "ThemeEditor" => geo.ThemeEditor,
        _ => null
    };

    private static void SetSite(WindowGeometry geo, string key, WindowSite site)
    {
        switch (key)
        {
            case "Main": geo.Main = site; break;
            case "Telemetry": geo.Telemetry = site; break;
            case "ColorEditor": geo.ColorEditor = site; break;
            case "ThemeEditor": geo.ThemeEditor = site; break;
        }
    }

    public static bool LoadGeometry(Window win, string geometryPath, string key)
    {
        try
        {
            if (!File.Exists(geometryPath)) return false;
            var json = File.ReadAllText(geometryPath);
            var geo = JsonSerializer.Deserialize<WindowGeometry>(json);
            if (geo == null) return false;
            var site = GetSite(geo, key);
            if (site == null) return false;
            win.Left = site.Left;
            win.Top = site.Top;
            win.WindowStartupLocation = WindowStartupLocation.Manual;
            return true;
        }
        catch { return false; }
    }

    public static void SaveGeometry(Window win, string geometryPath, string key)
    {
        try
        {
            WindowGeometry geo;
            if (File.Exists(geometryPath))
            {
                var json = File.ReadAllText(geometryPath);
                geo = JsonSerializer.Deserialize<WindowGeometry>(json) ?? new WindowGeometry();
            }
            else
            {
                geo = new WindowGeometry();
            }
            var site = GetSite(geo, key);
            if (site == null)
            {
                site = new WindowSite();
                SetSite(geo, key, site);
            }
            site.Left = (int)win.Left;
            site.Top = (int)win.Top;
            site.Width = (int)win.ActualWidth;
            site.Height = (int)win.ActualHeight;
            var outJson = JsonSerializer.Serialize(geo, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(geometryPath, outJson);
        }
        catch { }
    }
}
