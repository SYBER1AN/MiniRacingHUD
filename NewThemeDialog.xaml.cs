using System;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Res = MiniRacingHUD.Properties.Resources;

namespace MiniRacingHUD;

public partial class NewThemeDialog : Window
{
    private readonly ThemeColors _colors;
    private readonly Func<string, ThemeColors, string?> _onSave;
    private readonly Predicate<string> _isBuiltIn;
    private TextBox _nameBox = null!;
    private TextBlock _errorText = null!;
    private InputField? _theInputField;
    private EventHandler<CultureInfo>? _langHandler;

    private static readonly SolidColorBrush DefaultHintColor = new(Color.FromRgb(0x77, 0x77, 0x77));
    private static readonly SolidColorBrush ErrorColor = new(Color.FromRgb(0xF4, 0x32, 0x6D));

    public NewThemeDialog(string currentName, ThemeColors colors, Func<string, ThemeColors, string?> onSave, Predicate<string> isBuiltIn)
    {
        _colors = colors;
        _onSave = onSave;
        _isBuiltIn = isBuiltIn;

        InitializeComponent();
        BaseDialogWindow.SetupWindow(this);
        UpdateTitle();

        shell.closeBtn.Click += (_, _) => { DialogResult = false; Close(); };

        Loaded += (_, _) =>
        {
            _theInputField = FindVisualChild<InputField>(shell);
            _nameBox = _theInputField?.InputTextBox!;
            _errorText = FindVisualChildByTag<TextBlock>(shell, "ErrorText")!;
            if (_theInputField != null)
                _theInputField.Label = Res.Label_Name;
            _nameBox.Text = currentName == "Default" ? "" : currentName;
            _nameBox.PreviewTextInput += OnPreviewTextInput;
            DataObject.AddPastingHandler(_nameBox, OnPaste);
            _nameBox.Focus();
            _nameBox.SelectAll();
        };
        PreviewMouseDown += OnPreviewMouseDown;
        PreviewKeyDown += OnPreviewKeyDown;
        _langHandler = (_, _) =>
        {
            UpdateTitle();
            if (_theInputField != null)
                _theInputField.Label = Res.Label_Name;
        };
        LocalizationManager.CultureChanged += _langHandler;
        Closed += (_, _) => LocalizationManager.CultureChanged -= _langHandler;
    }

    private void UpdateTitle()
    {
        var title = Res.WindowTitle_NewTheme + Res.Label_ThemeNameHint;
        Title = title;
        shell.Title = title;
    }

    private void CreateButton_Click(object sender, RoutedEventArgs e)
    {
        if (ValidateAndSave())
        {
            DialogResult = true;
            Close();
        }
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private bool ValidateAndSave()
    {
        var text = _nameBox.Text.Trim();
        if (string.IsNullOrEmpty(text))
        {
            ShowError(Res.Validation_EnterThemeName);
            return false;
        }
        if (_isBuiltIn(text))
        {
            ShowError(Res.Validation_ThemeNameTaken);
            return false;
        }
        var err = _onSave(text, _colors);
        if (err != null)
        {
            ShowError(err);
            return false;
        }
        HideError();
        return true;
    }

    private void HideError()
    {
        _errorText.Visibility = Visibility.Collapsed;
    }

    private void ShowError(string message)
    {
        _errorText.Text = message;
        _errorText.Foreground = ErrorColor;
        _errorText.Visibility = Visibility.Visible;
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

    private void OnPreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        if (_nameBox.IsFocused && e.OriginalSource != _nameBox)
        {
            FocusManager.SetFocusedElement(this, null);
            Keyboard.ClearFocus();
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            e.Handled = true;
            CreateButton_Click(sender, e);
        }
        else if (e.Key == Key.Escape)
        {
            e.Handled = true;
            CancelButton_Click(sender, e);
        }
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

    private static T? FindVisualChild<T>(DependencyObject parent) where T : DependencyObject
    {
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is T t) return t;
            var found = FindVisualChild<T>(child);
            if (found != null) return found;
        }
        return null;
    }
}
