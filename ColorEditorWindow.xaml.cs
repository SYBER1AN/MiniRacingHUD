using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using Res = MiniRacingHUD.Properties.Resources;

namespace MiniRacingHUD;

public partial class ColorEditorWindow : Window
{
    private UIColors _colors;
    private UIColors _originalColors;
    private UIColors _defaultColors;
    private readonly Action<UIColors> _onApplySave;
    private readonly Action<UIColors> _onPreview;
    private readonly string _geometryPath;
    private string _selectedKey = "";
    private ColorPicker _colorPicker = null!;
    private EventHandler<CultureInfo>? _langHandler;

    public ObservableCollection<ColorGroupViewModel> LeftGroups { get; } = new();
    public ObservableCollection<ColorGroupViewModel> RightGroups { get; } = new();

    public ColorEditorWindow(UIColors current, UIColors defaultColors,
        Action<UIColors> onApplySave, Action<UIColors> onPreview, string geometryPath)
    {
        _colors = DeepClone(current);
        _originalColors = DeepClone(current);
        _defaultColors = DeepClone(defaultColors);
        _onApplySave = onApplySave;
        _onPreview = onPreview;
        _geometryPath = geometryPath;

        InitializeComponent();
        BaseDialogWindow.SetupWindow(this, _geometryPath, "ColorEditor");
        DataContext = this;

        RebuildGroups();

        shell.closeBtn.Click += (_, _) => { _onPreview(DeepClone(_originalColors)); Close(); };

        Loaded += OnLoaded;
        Closed += OnClosed;
        _langHandler = (_, _) => RebuildGroups();
        LocalizationManager.CultureChanged += _langHandler;
    }

    public void Refresh(UIColors newCurrent, UIColors newDefaults)
    {
        _colors = DeepClone(newCurrent);
        _originalColors = DeepClone(newCurrent);
        _defaultColors = DeepClone(newDefaults);
        RebuildGroups();
        SelectFirstItem();
    }

    private void SelectFirstItem()
    {
        var first = LeftGroups.FirstOrDefault()?.Items.FirstOrDefault();
        if (first != null && _colorPicker != null)
        {
            if (_selectedKey != first.Key)
            {
                DeselectCurrent();
                first.IsSelected = true;
            }
            _selectedKey = first.Key;
            var hex = GetEffectiveHex(_selectedKey);
            if (!string.IsNullOrEmpty(hex))
                try { _colorPicker.SetColor((Color)ColorConverter.ConvertFromString("#" + hex.TrimStart('#'))); }
                catch { }
            else
                _colorPicker.SetColor(Color.FromRgb(0x55, 0x55, 0x55));
            _colorPicker.SetOldPreview(GetOriginalColor(_selectedKey));
        }
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        BaseDialogWindow.SaveGeometry(this, _geometryPath, "ColorEditor");
        LocalizationManager.CultureChanged -= _langHandler;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _colorPicker = VisualTreeHelperEx.FindVisualChild<ColorPicker>(shell)!;
        if (_colorPicker == null) return;

        _colorPicker.ColorChanged += OnColorPickerColorChanged;
        _colorPicker.ResetToDefaultRequested += OnResetToDefault;
        InitPicker();
        SelectFirstItem();
    }

    private void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        _onApplySave(_colors);
        Close();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        _onPreview(DeepClone(_originalColors));
        Close();
    }

    private void ResetButton_Click(object sender, RoutedEventArgs e)
    {
        ResetAll();
    }

    private void ApplyButton_Click(object sender, RoutedEventArgs e)
    {
        _onApplySave(_colors);
        _originalColors = DeepClone(_colors);
    }

    private void ColorItem_PreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        var item = FindColorItemFromEvent(e);
        if (item == null || item.IsSelected) return;
        DeselectCurrent();
        item.IsSelected = true;
        _selectedKey = item.Key;

        var hex = GetEffectiveHex(_selectedKey);
        if (!string.IsNullOrEmpty(hex))
            try { _colorPicker.SetColor((Color)ColorConverter.ConvertFromString("#" + hex.TrimStart('#'))); }
            catch { }
        else
            _colorPicker.SetColor(Color.FromRgb(0x55, 0x55, 0x55));
        _colorPicker.SetOldPreview(GetOriginalColor(_selectedKey));
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
        _onPreview(CreatePartialColor(_selectedKey, hex));
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
        _onPreview(CreatePartialColor(_selectedKey, defaultHex));
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
        var initHex = GetEffectiveHex(_selectedKey);
        if (!string.IsNullOrEmpty(initHex))
            try { _colorPicker.SetColor((Color)ColorConverter.ConvertFromString("#" + initHex.TrimStart('#'))); }
            catch { }
        _colorPicker.SetOldPreview(GetOriginalColor(_selectedKey));
    }

    private static readonly Dictionary<string, Func<UIColors, string?>> ColorGetters = new()
    {
        ["pageBg"] = c => c.pageBg,
        ["panelBg"] = c => c.panelBg,
        ["sectionBg"] = c => c.sectionBg,
        ["elementBg"] = c => c.elementBg,
        ["accent"] = c => c.accent,
        ["bindCont"] = c => c.bindCont,
        ["panelCont"] = c => c.panelCont,
        ["elementCont"] = c => c.elementCont,
        ["helpBg"] = c => c.helpBg,
        ["helpCont"] = c => c.helpCont,
        ["helpHeading"] = c => c.helpHeading,
        ["disabledBg"] = c => c.disabledBg,
        ["disabledCont"] = c => c.disabledCont,
        ["border"] = c => c.border,
        ["lastActive"] = c => c.lastActive,
        ["scrollbarTrack"] = c => c.scrollbarTrack,
        ["dangerBg"] = c => c.dangerBg,
        ["dangerCont"] = c => c.dangerCont,
        ["toggleOff"] = c => c.toggleOff,
        ["toggleOn"] = c => c.toggleOn,
        ["codeBg"] = c => c.codeBg,
        ["codeCont"] = c => c.codeCont,
    };

    private static readonly Dictionary<string, Action<UIColors, string?>> ColorSetters = new()
    {
        ["pageBg"] = (c, v) => c.pageBg = v,
        ["panelBg"] = (c, v) => c.panelBg = v,
        ["sectionBg"] = (c, v) => c.sectionBg = v,
        ["elementBg"] = (c, v) => c.elementBg = v,
        ["accent"] = (c, v) => c.accent = v,
        ["bindCont"] = (c, v) => c.bindCont = v,
        ["panelCont"] = (c, v) => c.panelCont = v,
        ["elementCont"] = (c, v) => c.elementCont = v,
        ["helpBg"] = (c, v) => c.helpBg = v,
        ["helpCont"] = (c, v) => c.helpCont = v,
        ["helpHeading"] = (c, v) => c.helpHeading = v,
        ["disabledBg"] = (c, v) => c.disabledBg = v,
        ["disabledCont"] = (c, v) => c.disabledCont = v,
        ["border"] = (c, v) => c.border = v,
        ["lastActive"] = (c, v) => c.lastActive = v,
        ["scrollbarTrack"] = (c, v) => c.scrollbarTrack = v,
        ["dangerBg"] = (c, v) => c.dangerBg = v,
        ["dangerCont"] = (c, v) => c.dangerCont = v,
        ["toggleOff"] = (c, v) => c.toggleOff = v,
        ["toggleOn"] = (c, v) => c.toggleOn = v,
        ["codeBg"] = (c, v) => c.codeBg = v,
        ["codeCont"] = (c, v) => c.codeCont = v,
    };

    private string? GetColorValue(string key) =>
        ColorGetters.TryGetValue(key, out var getter) ? getter(_colors) : null;

    private string? GetEffectiveHex(string key) => GetColorValue(key) ?? GetDefaultHex(key);

    private void SetColorValue(string key, string? value)
    {
        if (!ColorSetters.TryGetValue(key, out var setter)) return;
        if (string.IsNullOrEmpty(value) || !Regex.IsMatch(value, @"^#?[0-9a-fA-F]{6,8}$"))
            setter(_colors, null);
        else
            setter(_colors, value.Replace("#", "").ToLower());
    }

    private string? GetDefaultHex(string key) =>
        ColorGetters.TryGetValue(key, out var getter) ? getter(_defaultColors)?.TrimStart('#') : null;

    private Color GetOriginalColor(string key)
    {
        var hex = ColorGetters.TryGetValue(key, out var getter) ? getter(_originalColors) : null;
        hex ??= GetDefaultHex(key);
        if (!string.IsNullOrEmpty(hex))
            try { return (Color)ColorConverter.ConvertFromString("#" + hex.TrimStart('#')); }
            catch { }
        return Color.FromRgb(0x55, 0x55, 0x55);
    }

    private static UIColors CreatePartialColor(string key, string? hex)
    {
        var c = new UIColors();
        if (ColorSetters.TryGetValue(key, out var setter))
            setter(c, hex);
        return c;
    }

    private static UIColors DeepClone(UIColors source)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(source);
        return System.Text.Json.JsonSerializer.Deserialize<UIColors>(json) ?? new();
    }

    private record ColorItem(string Key, string Label);
    private record ColorGroup(string Header, ColorItem[] Items);

    private static ColorGroup[] GetColorGroups() =>
    [
        new(Res.ColorGroup_Background,
        [
            new ColorItem("pageBg", Res.ColorItem_PageBg),
            new ColorItem("panelBg", Res.ColorItem_PanelBg),
            new ColorItem("sectionBg", Res.ColorItem_SectionBg),
        ]),
        new(Res.ColorGroup_Controls,
        [
            new ColorItem("panelCont", Res.ColorItem_PanelCont),
            new ColorItem("accent", Res.ColorItem_Accent),
            new ColorItem("bindCont", Res.ColorItem_BindCont),
            new ColorItem("toggleOn", Res.ColorItem_ToggleOn),
            new ColorItem("toggleOff", Res.ColorItem_ToggleOff),
            new ColorItem("elementBg", Res.ColorItem_ElementBg),
            new ColorItem("elementCont", Res.ColorItem_ElementCont),
            new ColorItem("disabledBg", Res.ColorItem_DisabledBg),
            new ColorItem("disabledCont", Res.ColorItem_DisabledCont),
            new ColorItem("scrollbarTrack", Res.ColorItem_ScrollbarTrack),
        ]),
        new(Res.ColorGroup_Other,
        [
            new ColorItem("codeBg", Res.ColorItem_CodeBg),
            new ColorItem("codeCont", Res.ColorItem_CodeCont),
            new ColorItem("lastActive", Res.ColorItem_LastActive),
            new ColorItem("dangerBg", Res.ColorItem_DangerBg),
            new ColorItem("dangerCont", Res.ColorItem_DangerCont),
            new ColorItem("border", Res.ColorItem_Border),
        ]),
        new(Res.ColorGroup_Help,
        [
            new ColorItem("helpBg", Res.ColorItem_HelpBg),
            new ColorItem("helpCont", Res.ColorItem_HelpCont),
            new ColorItem("helpHeading", Res.ColorItem_HelpHeading),
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
                    Hex = hex ?? "",
                    DefaultHex = GetDefaultHex(item.Key) ?? ""
                });
            }
            if (i < 2) LeftGroups.Add(vm); else RightGroups.Add(vm);
        }
        var first = LeftGroups.FirstOrDefault()?.Items?.FirstOrDefault()
                    ?? RightGroups.FirstOrDefault()?.Items?.FirstOrDefault();
        if (first != null)
        {
            first.IsSelected = true;
            _selectedKey = first.Key;
        }
    }
}

public class ColorGroupViewModel
{
    public string Header { get; set; } = "";
    public ObservableCollection<ColorItemViewModel> Items { get; } = new();
}

public class ColorItemViewModel : INotifyPropertyChanged
{
    private string _key = "";
    private string _label = "";
    private string _hex = "";
    private string _defaultHex = "";
    private bool _isSelected;

    public string Key { get => _key; set { _key = value; OnPropertyChanged(); } }
    public string Label { get => _label; set { _label = value; OnPropertyChanged(); } }

    public string Hex
    {
        get => _hex;
        set
        {
            _hex = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(EffectiveHex));
            OnPropertyChanged(nameof(HexDisplay));
        }
    }

    public string DefaultHex
    {
        get => _defaultHex;
        set
        {
            _defaultHex = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(EffectiveHex));
            OnPropertyChanged(nameof(HexDisplay));
        }
    }

    public string EffectiveHex => !string.IsNullOrEmpty(Hex) ? Hex : DefaultHex;

    public string HexDisplay => !string.IsNullOrEmpty(EffectiveHex) ? "#" + EffectiveHex.TrimStart('#') : "\u2014";

    public bool IsSelected
    {
        get => _isSelected;
        set { _isSelected = value; OnPropertyChanged(); }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

public class HexToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is string hex && !string.IsNullOrEmpty(hex))
            try { return new SolidColorBrush((Color)ColorConverter.ConvertFromString("#" + hex.TrimStart('#'))); }
            catch { }
        return new SolidColorBrush(Color.FromRgb(0x55, 0x55, 0x55));
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotImplementedException();
}

