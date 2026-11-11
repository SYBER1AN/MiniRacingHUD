using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using Res = MiniRacingHUD.Properties.Resources;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace MiniRacingHUD;

public partial class ThemeEditorWindow : Window
{
    private ThemeColors _colors;
    private ThemeColors _originalColors;
    private readonly ThemeColors _defaultColors;
    private readonly string _themeDisplayName;
    private readonly Func<string, ThemeColors, string?> _onSave;
    private readonly Action<ThemeColors> _onPreview;
    private readonly Predicate<string> _isBuiltInTheme;
    private readonly string _geometryPath;
    private string _selectedKey = "";
    private TextBox _nameBox = null!;
    private ColorPicker _colorPicker = null!;
    private EventHandler<CultureInfo>? _langHandler;

    public ObservableCollection<ColorGroupViewModel> LeftGroups { get; } = new();
    public ObservableCollection<ColorGroupViewModel> RightGroups { get; } = new();

    public ThemeEditorWindow(ThemeColors current, ThemeColors defaultColors, string themeDisplayName,
        Predicate<string> isBuiltInTheme, Func<string, ThemeColors, string?> onSave,
        Action<ThemeColors> onPreview, string geometryPath)
    {
        _colors = DeepClone(current);
        _originalColors = DeepClone(current);
        _defaultColors = DeepClone(defaultColors);
        _themeDisplayName = themeDisplayName;
        _isBuiltInTheme = isBuiltInTheme;
        _onSave = onSave;
        _onPreview = onPreview;
        _geometryPath = geometryPath;

        InitializeComponent();
        BaseDialogWindow.SetupWindow(this, _geometryPath, "ThemeEditor");
        DataContext = this;
        UpdateTitle();

        RebuildGroups();

        shell.closeBtn.Click += (_, _) => { _onPreview(DeepClone(_originalColors)); Close(); };

        Loaded += OnLoaded;
        Closed += OnClosed;
        _langHandler = (_, _) =>
        {
            UpdateTitle();
            RebuildGroups();
        };
        LocalizationManager.CultureChanged += _langHandler;
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        BaseDialogWindow.SaveGeometry(this, _geometryPath, "ThemeEditor");
        LocalizationManager.CultureChanged -= _langHandler;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _nameBox = VisualTreeHelperEx.FindVisualChildByTag<InputField>(shell, "ThemeNameField")?.InputTextBox!;
        _colorPicker = VisualTreeHelperEx.FindVisualChild<ColorPicker>(shell)!;
        if (_nameBox == null || _colorPicker == null) return;

        _nameBox.Text = _themeDisplayName;
        _nameBox.PreviewTextInput += OnPreviewTextInput;
        DataObject.AddPastingHandler(_nameBox, OnPaste);

        _colorPicker.ColorChanged += OnColorPickerColorChanged;
        _colorPicker.ResetToDefaultRequested += OnResetToDefault;
        InitPicker();
    }

    private void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        var n = _nameBox.Text.Trim();
        if (!string.IsNullOrEmpty(n) && !_isBuiltInTheme(n))
        {
            var error = _onSave(n, _colors);
            if (error == null) { Close(); return; }
        }
        ShowNewThemeDialog(n);
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        _onPreview(DeepClone(_originalColors));
        Close();
    }

    private void ResetButton_Click(object sender, RoutedEventArgs e) => ResetAll();

    private void ApplyButton_Click(object sender, RoutedEventArgs e)
    {
        var n = _nameBox.Text.Trim();
        if (!string.IsNullOrEmpty(n) && !_isBuiltInTheme(n))
        {
            var error = _onSave(n, _colors);
            if (error == null)
                _originalColors = DeepClone(_colors);
            return;
        }
        ShowNewThemeDialog(n);
    }

    private void ShowNewThemeDialog(string currentName)
    {
        var dialog = new NewThemeDialog(currentName, _colors, _onSave, _isBuiltInTheme)
        {
            Owner = this
        };
        if (dialog.ShowDialog() == true) Close();
    }

    private void ColorItem_PreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        var item = FindColorItemFromEvent(e);
        if (item == null || item.IsSelected) return;
        DeselectCurrent();
        item.IsSelected = true;
        _selectedKey = item.Key;

        var hex = GetColorValue(_selectedKey);
        if (!string.IsNullOrEmpty(hex))
            try { _colorPicker.SetColor((Color)ColorConverter.ConvertFromString("#" + hex.TrimStart('#'))); }
            catch { }
        else
            _colorPicker.SetColor(Color.FromRgb(0x55, 0x55, 0x55));
        _colorPicker.SetOldPreview(GetColorFromKey(_originalColors, _selectedKey));
    }

    private static ColorItemViewModel? FindColorItemFromEvent(MouseButtonEventArgs e)
    {
        var element = e.OriginalSource as DependencyObject;
        while (element != null)
        {
            if (element is FrameworkElement { DataContext: ColorItemViewModel item })
                return item;
            element = VisualTreeHelper.GetParent(element);
        }
        return null;
    }

    private void DeselectCurrent()
    {
        foreach (var group in LeftGroups.Concat(RightGroups))
            foreach (var item in group.Items)
                if (item.IsSelected) { item.IsSelected = false; return; }
    }

    private void OnColorPickerColorChanged(object? sender, RoutedPropertyChangedEventArgs<Color> args)
    {
        var c = args.NewValue;
        var hex = $"{c.R:X2}{c.G:X2}{c.B:X2}".ToLower();
        SetColorValue(_selectedKey, hex);
        UpdateItemHex(_selectedKey, hex);
        _onPreview(CreatePartialTheme(_selectedKey, hex));
    }

    private void OnResetToDefault()
    {
        var defaultHex = GetDefaultHex(_selectedKey);
        SetColorValue(_selectedKey, defaultHex);
        if (defaultHex != null)
        {
            UpdateItemHex(_selectedKey, defaultHex);
            _colorPicker.SetColor((Color)ColorConverter.ConvertFromString("#" + defaultHex));
        }
        _onPreview(CreatePartialTheme(_selectedKey, defaultHex));
    }

    private void UpdateItemHex(string key, string hex)
    {
        foreach (var group in LeftGroups.Concat(RightGroups))
            foreach (var item in group.Items)
                if (item.Key == key) { item.Hex = hex; return; }
    }

    private void ResetAll()
    {
        var defaults = DeepClone(_defaultColors);
        _colors = DeepClone(_defaultColors);
        _onPreview(defaults);
        foreach (var group in LeftGroups.Concat(RightGroups))
            foreach (var item in group.Items)
                item.Hex = GetDefaultHex(item.Key) ?? "";
        var firstHex = GetDefaultHex(_selectedKey);
        if (firstHex != null)
            _colorPicker.SetColor((Color)ColorConverter.ConvertFromString("#" + firstHex));
    }

    private void InitPicker()
    {
        var initHex = GetColorValue(_selectedKey);
        if (!string.IsNullOrEmpty(initHex))
            try { _colorPicker.SetColor((Color)ColorConverter.ConvertFromString("#" + initHex.TrimStart('#'))); }
            catch { }
        _colorPicker.SetOldPreview(GetColorFromKey(_originalColors, _selectedKey));
    }

    private void OnPreviewTextInput(object sender, TextCompositionEventArgs e)
    {
        e.Handled = !Regex.IsMatch(e.Text, @"^[a-zA-Zа-яА-ЯёЁ0-9 _\-]$");
    }

    private void OnPaste(object sender, DataObjectPastingEventArgs e)
    {
        if (e.DataObject.GetDataPresent(DataFormats.Text))
        {
            var text = (string)e.DataObject.GetData(DataFormats.Text);
            if (!Regex.IsMatch(text, @"^[a-zA-Zа-яА-ЯёЁ0-9 _\-]+$"))
                e.Handled = true;
        }
    }

    private static readonly Dictionary<string, Func<ThemeColors, string?>> ThemeGetters = new()
    {
        ["widgetBg"] = c => c.widgetBg,
        ["wheelRim"] = c => c.wheelRim,
        ["wheelSpoke"] = c => c.wheelSpoke,
        ["wheelMarker"] = c => c.wheelMarker,
        ["gmeterMiddle"] = c => c.gmeterMiddle,
        ["gmeterInner"] = c => c.gmeterInner,
        ["gmeterOuter"] = c => c.gmeterOuter,
        ["gmeterBall"] = c => c.gmeterBall,
        ["gmeterCrosshairDashed"] = c => c.gmeterCrosshairDashed,
        ["gmeterRingsDashed"] = c => c.gmeterRingsDashed,
        ["gmeterTrail"] = c => c.gmeterTrail,
        ["gmeterBorder"] = c => c.gmeterBorder,
        ["gearBg"] = c => c.gearBg,
        ["gearText"] = c => c.gearText,
        ["gearNBg"] = c => c.gearNBg,
        ["gearNText"] = c => c.gearNText,
        ["gearRBg"] = c => c.gearRBg,
        ["gearRText"] = c => c.gearRText,
        ["pedalBg"] = c => c.pedalBg,
        ["pedalHandbrake"] = c => c.pedalHandbrake,
        ["pedalClutch"] = c => c.pedalClutch,
        ["pedalBrake"] = c => c.pedalBrake,
        ["pedalThrottle"] = c => c.pedalThrottle,
        ["pedalText"] = c => c.pedalText,
        ["graphGrid"] = c => c.graphGrid,
        ["graphText"] = c => c.graphText,
        ["tvdPos"] = c => c.tvdPos,
        ["tvdText"] = c => c.tvdText,
        ["tvdDim"] = c => c.tvdDim,
        ["tvdPlus"] = c => c.tvdPlus,
        ["tvdMinus"] = c => c.tvdMinus,
    };

    private static readonly Dictionary<string, Action<ThemeColors, string?>> ThemeSetters = new()
    {
        ["widgetBg"] = (c, v) => c.widgetBg = v,
        ["wheelRim"] = (c, v) => c.wheelRim = v,
        ["wheelSpoke"] = (c, v) => c.wheelSpoke = v,
        ["wheelMarker"] = (c, v) => c.wheelMarker = v,
        ["gmeterMiddle"] = (c, v) => c.gmeterMiddle = v,
        ["gmeterInner"] = (c, v) => c.gmeterInner = v,
        ["gmeterOuter"] = (c, v) => c.gmeterOuter = v,
        ["gmeterBall"] = (c, v) => c.gmeterBall = v,
        ["gmeterCrosshairDashed"] = (c, v) => c.gmeterCrosshairDashed = v,
        ["gmeterRingsDashed"] = (c, v) => c.gmeterRingsDashed = v,
        ["gmeterTrail"] = (c, v) => c.gmeterTrail = v,
        ["gmeterBorder"] = (c, v) => c.gmeterBorder = v,
        ["gearBg"] = (c, v) => c.gearBg = v,
        ["gearText"] = (c, v) => c.gearText = v,
        ["gearNBg"] = (c, v) => c.gearNBg = v,
        ["gearNText"] = (c, v) => c.gearNText = v,
        ["gearRBg"] = (c, v) => c.gearRBg = v,
        ["gearRText"] = (c, v) => c.gearRText = v,
        ["pedalBg"] = (c, v) => c.pedalBg = v,
        ["pedalHandbrake"] = (c, v) => c.pedalHandbrake = v,
        ["pedalClutch"] = (c, v) => c.pedalClutch = v,
        ["pedalBrake"] = (c, v) => c.pedalBrake = v,
        ["pedalThrottle"] = (c, v) => c.pedalThrottle = v,
        ["pedalText"] = (c, v) => c.pedalText = v,
        ["graphGrid"] = (c, v) => c.graphGrid = v,
        ["graphText"] = (c, v) => c.graphText = v,
        ["tvdPos"] = (c, v) => c.tvdPos = v,
        ["tvdText"] = (c, v) => c.tvdText = v,
        ["tvdDim"] = (c, v) => c.tvdDim = v,
        ["tvdPlus"] = (c, v) => c.tvdPlus = v,
        ["tvdMinus"] = (c, v) => c.tvdMinus = v,
    };

    private string? GetColorValue(string key) =>
        ThemeGetters.TryGetValue(key, out var getter) ? getter(_colors) : null;

    private void SetColorValue(string key, string? value)
    {
        if (!ThemeSetters.TryGetValue(key, out var setter)) return;
        if (string.IsNullOrEmpty(value) || !Regex.IsMatch(value, @"^#?[0-9a-fA-F]{6,8}$"))
            setter(_colors, null);
        else
            setter(_colors, value.Replace("#", "").ToLower());
    }

    private string? GetDefaultHex(string key) =>
        ThemeGetters.TryGetValue(key, out var getter) ? getter(_defaultColors)?.TrimStart('#') : null;

    private static Color GetColorFromKey(ThemeColors colors, string key)
    {
        if (ThemeGetters.TryGetValue(key, out var getter))
        {
            var val = getter(colors);
            if (!string.IsNullOrEmpty(val))
                try { return (Color)ColorConverter.ConvertFromString("#" + val.TrimStart('#')); }
                catch { }
        }
        return Color.FromRgb(0x55, 0x55, 0x55);
    }

    private static ThemeColors CreatePartialTheme(string key, string? hex)
    {
        var t = new ThemeColors();
        if (ThemeSetters.TryGetValue(key, out var setter))
            setter(t, hex);
        return t;
    }

    private static ThemeColors DeepClone(ThemeColors source)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(source);
        return System.Text.Json.JsonSerializer.Deserialize<ThemeColors>(json) ?? new();
    }

    private record ColorItem(string Key, string Label);
    private record ColorGroup(string Header, ColorItem[] Items);

    private static ColorGroup[] GetColorGroups() =>
    [
        new(Res.ThemeGroup_Wheel,
        [
            new ColorItem("wheelRim", Res.ThemeItem_WheelRim),
            new ColorItem("wheelSpoke", Res.ThemeItem_WheelSpoke),
            new ColorItem("wheelMarker", Res.ThemeItem_WheelMarker),
        ]),
        new(Res.ThemeGroup_Pedals,
        [
            new ColorItem("pedalBg", Res.ThemeItem_PedalBg),
            new ColorItem("pedalText", Res.ThemeItem_PedalText),
            new ColorItem("pedalThrottle", Res.ThemeItem_PedalThrottle),
            new ColorItem("pedalBrake", Res.ThemeItem_PedalBrake),
            new ColorItem("pedalClutch", Res.ThemeItem_PedalClutch),
            new ColorItem("pedalHandbrake", Res.ThemeItem_PedalHandbrake),
        ]),
        new(Res.ThemeGroup_Gearbox,
        [
            new ColorItem("gearBg", Res.ThemeItem_GearBg),
            new ColorItem("gearText", Res.ThemeItem_GearText),
            new ColorItem("gearRBg", Res.ThemeItem_GearRBg),
            new ColorItem("gearRText", Res.ThemeItem_GearRText),
            new ColorItem("gearNBg", Res.ThemeItem_GearNBg),
            new ColorItem("gearNText", Res.ThemeItem_GearNText),
        ]),
        new(Res.ThemeGroup_Gmeter,
        [
            new ColorItem("gmeterBorder", Res.ThemeItem_GmeterBorder),
            new ColorItem("gmeterOuter", Res.ThemeItem_GmeterOuter),
            new ColorItem("gmeterMiddle", Res.ThemeItem_GmeterMiddle),
            new ColorItem("gmeterInner", Res.ThemeItem_GmeterInner),
            new ColorItem("gmeterRingsDashed", Res.ThemeItem_GmeterRingsDashed),
            new ColorItem("gmeterCrosshairDashed", Res.ThemeItem_GmeterCrosshairDashed),
            new ColorItem("gmeterBall", Res.ThemeItem_GmeterBall),
            new ColorItem("gmeterTrail", Res.ThemeItem_GmeterTrail),
        ]),
        new(Res.ThemeGroup_General,
        [
            new ColorItem("widgetBg", Res.ThemeItem_WidgetBg),
            new ColorItem("graphGrid", Res.ThemeItem_GraphGrid),
            new ColorItem("graphText", Res.ThemeItem_GraphText),
        ]),
        new(Res.ThemeGroup_TvdResults,
        [
            new ColorItem("tvdPos", Res.ThemeItem_TvdPos),
            new ColorItem("tvdText", Res.ThemeItem_TvdText),
            new ColorItem("tvdDim", Res.ThemeItem_TvdDim),
            new ColorItem("tvdPlus", Res.ThemeItem_TvdPlus),
            new ColorItem("tvdMinus", Res.ThemeItem_TvdMinus),
        ]),
    ];

    private void RebuildGroups()
    {
        var groups = GetColorGroups();
        LeftGroups.Clear();
        RightGroups.Clear();
        for (int i = 0; i < groups.Length; i++)
        {
            var group = groups[i];
            var vm = new ColorGroupViewModel { Header = group.Header };
            foreach (var item in group.Items)
            {
                var hex = GetColorValue(item.Key);
                vm.Items.Add(new ColorItemViewModel
                {
                    Key = item.Key,
                    Label = item.Label,
                    Hex = hex ?? ""
                });
            }
            if (i < 3) LeftGroups.Add(vm); else RightGroups.Add(vm);
        }
        var first = LeftGroups.FirstOrDefault()?.Items?.FirstOrDefault()
                    ?? RightGroups.FirstOrDefault()?.Items?.FirstOrDefault();
        if (first != null)
        {
            first.IsSelected = true;
            _selectedKey = first.Key;
        }
    }

    private void UpdateTitle()
    {
        shell.Title = string.Format(Res.WindowTitle_ThemeEditorWithName, _themeDisplayName);
    }
}
