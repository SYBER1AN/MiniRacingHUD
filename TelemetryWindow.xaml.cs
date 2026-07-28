using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using MiniRacingHUD.Telemetry;

namespace MiniRacingHUD;

public partial class TelemetryWindow : Window
{
    private readonly ITelemetryProvider? _provider;
    private readonly Func<string> _getSelectedGame;
    private readonly string _geometryPath;
    private readonly System.Threading.Timer? _displayTimer;
    private readonly TelemetryWindowViewModel _vm = new();
    private readonly Dictionary<string, TextBlock> _valueBlocks = new();
    private TextBlock _statusBlock = null!;
    private Border _secondaryCol = null!;
    private List<string> _lastFieldKeys = new();
    private EventHandler<CultureInfo>? _langHandler;

    public TelemetryWindow(
        ITelemetryProvider? provider,
        Func<string> getSelectedGame,
        string geometryPath)
    {
        _provider = provider;
        _getSelectedGame = getSelectedGame;
        _geometryPath = geometryPath;

        InitializeComponent();
        BaseDialogWindow.SetupWindow(this, _geometryPath, "Telemetry");
        DataContext = _vm;

        shell.closeBtn.Click += (_, _) => Close();

        BuildColumns();

        Loaded += OnLoaded;

        _langHandler = (_, _) =>
        {
            if (_statusBlock != null)
            {
                _statusBlock.Text = Properties.Resources.Status_WaitingForData;
                _statusBlock.Foreground = Brushes.Orange;
            }
        };
        LocalizationManager.CultureChanged += _langHandler;

        _displayTimer = new System.Threading.Timer(
            _ => Dispatcher.BeginInvoke(UpdateDisplay),
            null, 33, 33);

        Closed += (_, _) =>
        {
            _displayTimer?.Dispose();
            BaseDialogWindow.SaveGeometry(this, _geometryPath, "Telemetry");
            LocalizationManager.CultureChanged -= _langHandler;
        };
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _statusBlock = FindVisualChildByTag<TextBlock>(shell, "StatusText")!;
        _secondaryCol = FindVisualChildByTag<Border>(shell, "SecondaryCol")!;
        _secondaryCol.Visibility = _vm.SecondaryColumn.Fields.Count > 0
            ? Visibility.Visible
            : Visibility.Collapsed;
        Dispatcher.BeginInvoke(RefreshValueBlocks, DispatcherPriority.Background);
    }

    private void RefreshValueBlocks()
    {
        _valueBlocks.Clear();
        foreach (var tb in FindVisualChildren<TextBlock>(shell))
        {
            if (tb.Tag is string key && !string.IsNullOrEmpty(key) && key != "StatusText")
                _valueBlocks[key] = tb;
        }
    }

    private void BuildColumns()
    {
        _vm.PrimaryColumn.Fields.Clear();
        _vm.SecondaryColumn.Fields.Clear();
        _valueBlocks.Clear();
        var fields = _provider?.Fields.ToList() ?? new List<(string, string)>();
        const int maxRows = 32;

        for (int i = 0; i < fields.Count && i < maxRows; i++)
        {
            _vm.PrimaryColumn.Fields.Add(new TelemetryFieldViewModel
            {
                Label = fields[i].label,
                Key = fields[i].key,
                RowBackground = i % 2 == 1
                    ? new SolidColorBrush(Color.FromRgb(0x15, 0x1B, 0x23))
                    : Brushes.Transparent
            });
        }

        for (int i = maxRows; i < fields.Count; i++)
        {
            _vm.SecondaryColumn.Fields.Add(new TelemetryFieldViewModel
            {
                Label = fields[i].label,
                Key = fields[i].key,
                RowBackground = (i - maxRows) % 2 == 1
                    ? new SolidColorBrush(Color.FromRgb(0x15, 0x1B, 0x23))
                    : Brushes.Transparent
            });
        }

        if (_secondaryCol != null)
            _secondaryCol.Visibility = _vm.SecondaryColumn.Fields.Count > 0
                ? Visibility.Visible
                : Visibility.Collapsed;

        _lastFieldKeys = fields.Select(f => f.key).ToList();
    }

    private void ResizeToContent()
    {
        SizeToContent = SizeToContent.Width;
        UpdateLayout();
        SizeToContent = SizeToContent.Height;
        UpdateLayout();
        SizeToContent = SizeToContent.Manual;
    }

    private void UpdateDisplay()
    {
        if (_statusBlock == null) return;

        var fields = _provider?.Fields.ToList() ?? new List<(string, string)>();
        var currentKeys = fields.Select(f => f.key).ToList();

        if (!currentKeys.SequenceEqual(_lastFieldKeys))
        {
            BuildColumns();
            ResizeToContent();
            RefreshValueBlocks();
            return;
        }

        var telemetryDict = _provider?.ReadTelemetry();

        if (telemetryDict == null || telemetryDict.Count == 0)
        {
            _statusBlock.Text = Properties.Resources.Status_WaitingForData;
            _statusBlock.Foreground = Brushes.Orange;
            return;
        }

        foreach (var field in fields)
        {
            if (!_valueBlocks.TryGetValue(field.key, out var valueBlock)) continue;

            if (telemetryDict.TryGetValue(field.key, out var rawValue))
            {
                valueBlock.Text = rawValue is float f
                    ? f.ToString("F4")
                    : rawValue.ToString() ?? "---";

                valueBlock.Foreground = rawValue is float floatVal
                    ? floatVal > 0.0001f ? Brushes.Lime
                    : floatVal < -0.0001f ? Brushes.Red
                    : Brushes.Gray
                    : Brushes.Gray;
            }
            else
            {
                valueBlock.Text = "---";
                valueBlock.Foreground = Brushes.Gray;
            }
        }

        _statusBlock.Text = string.Format(Properties.Resources.Status_LiveTelemetry, 30);
        _statusBlock.Foreground = Application.Current.Resources["GreenBrush"] as SolidColorBrush ?? Brushes.LimeGreen;
    }

    private static T? FindVisualChildByTag<T>(DependencyObject parent, object tag) where T : DependencyObject
    {
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is T t && (child as FrameworkElement)?.Tag?.ToString() == tag.ToString())
                return t;
            var found = FindVisualChildByTag<T>(child, tag);
            if (found != null) return found;
        }
        return null;
    }

    private static IEnumerable<T> FindVisualChildren<T>(DependencyObject parent) where T : DependencyObject
    {
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is T t) yield return t;
            foreach (var c in FindVisualChildren<T>(child))
                yield return c;
        }
    }
}

public class TelemetryWindowViewModel : INotifyPropertyChanged
{
    public TelemetryColumnViewModel PrimaryColumn { get; } = new();
    public TelemetryColumnViewModel SecondaryColumn { get; } = new();

    private string _statusText = Properties.Resources.Status_WaitingForData;
    public string StatusText
    {
        get => _statusText;
        set { _statusText = value; OnPropertyChanged(); }
    }

    private Brush _statusForeground = Brushes.Orange;
    public Brush StatusForeground
    {
        get => _statusForeground;
        set { _statusForeground = value; OnPropertyChanged(); }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

public class TelemetryColumnViewModel
{
    public ObservableCollection<TelemetryFieldViewModel> Fields { get; } = new();
}

public class TelemetryFieldViewModel : INotifyPropertyChanged
{
    public string Label { get; set; } = "";
    public string Key { get; set; } = "";
    public Brush RowBackground { get; set; } = Brushes.Transparent;

    private string _value = "---";
    public string Value
    {
        get => _value;
        set { _value = value; OnPropertyChanged(); }
    }

    private Brush _foreground = Brushes.Gray;
    public Brush Foreground
    {
        get => _foreground;
        set { _foreground = value; OnPropertyChanged(); }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
