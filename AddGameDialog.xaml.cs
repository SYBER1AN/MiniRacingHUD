using System;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Res = MiniRacingHUD.Properties.Resources;

namespace MiniRacingHUD;

public partial class AddGameDialog : Window
{
    private static readonly SolidColorBrush DefaultHintColor = new(Color.FromRgb(0x77, 0x77, 0x77));
    private static readonly SolidColorBrush ErrorColor = new(Color.FromRgb(0xf4, 0x32, 0x6d));

    private readonly TextBox _nameBox;
    private readonly TextBlock _errorText;
    private readonly InputField _inputField;
    private readonly Button _okBtn;
    private readonly Button _cancelBtn;
    private EventHandler<CultureInfo>? _langHandler;

    public string GameName { get; private set; } = "";

    public AddGameDialog(string defaultName, Window owner)
    {
        Owner = owner;
        InitializeComponent();
        BaseDialogWindow.SetupWindow(this);
        MinWidth = 420;
        UpdateTitle();

        shell.closeBtn.Click += (_, _) => { DialogResult = false; Close(); };

        _inputField = new InputField
        {
            Label = Res.Label_GameName,
            Text = defaultName,
            MaxLength = 40,
            ToolTipText = Res.Tooltip_GameName,
            Margin = new Thickness(32, 16, 32, 0),
        };

        _nameBox = _inputField.InputTextBox;
        _nameBox.PreviewTextInput += (_, e) =>
        {
            e.Handled = !System.Text.RegularExpressions.Regex.IsMatch(e.Text, @"^[a-zA-Zа-яА-ЯёЁ0-9 _\-]$");
        };
        DataObject.AddPastingHandler(_nameBox, (_, e) =>
        {
            if (e.DataObject.GetDataPresent(DataFormats.Text))
            {
                var text = (string)e.DataObject.GetData(DataFormats.Text);
                if (!System.Text.RegularExpressions.Regex.IsMatch(text, @"^[a-zA-Zа-яА-ЯёЁ0-9 _\-]+$"))
                    e.Handled = true;
            }
        });

        _errorText = new TextBlock
        {
            Text = "",
            FontSize = 10,
            Foreground = DefaultHintColor,
            Visibility = Visibility.Collapsed,
            Margin = new Thickness(32, 4, 32, 0),
        };

        _okBtn = new Button
        {
            Content = Res.Button_Add,
            Style = (Style)Application.Current.TryFindResource("GreenButton")!,
            Width = 120,
            Height = 32,
        };
        _okBtn.Click += (_, _) => ValidateAndSave();

        _cancelBtn = new Button
        {
            Content = Res.Dialog_ButtonCancel,
            Style = (Style)Application.Current.TryFindResource("GrayButton")!,
            Width = 120,
            Height = 32,
        };
        _cancelBtn.Click += (_, _) => { DialogResult = false; Close(); };

        var btnPanel = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(32, 12, 32, 16),
        };
        btnPanel.Children.Add(_okBtn);
        btnPanel.Children.Add(new Border { Width = 16 });
        btnPanel.Children.Add(_cancelBtn);

        var content = new StackPanel();
        content.Children.Add(_inputField);
        content.Children.Add(_errorText);
        content.Children.Add(btnPanel);

        shell.contentArea.Content = content;

        _langHandler = (_, _) => UpdateLocalizedStrings();
        LocalizationManager.CultureChanged += _langHandler;
        Closed += (_, _) => LocalizationManager.CultureChanged -= _langHandler;
    }

    private void UpdateTitle()
    {
        var title = Res.WindowTitle_AddGame + Res.Label_ThemeNameHint;
        Title = title;
        shell.Title = title;
    }

    private void UpdateLocalizedStrings()
    {
        UpdateTitle();
        _inputField.Label = Res.Label_GameName;
        _inputField.ToolTipText = Res.Tooltip_GameName;
        _okBtn.Content = Res.Button_Add;
        _cancelBtn.Content = Res.Dialog_ButtonCancel;
    }

    private void ValidateAndSave()
    {
        var text = _nameBox.Text.Trim();
        if (string.IsNullOrEmpty(text))
        {
            _errorText.Text = Res.Validation_EnterGameName;
            _errorText.Foreground = ErrorColor;
            _errorText.Visibility = Visibility.Visible;
            return;
        }
        if (!System.Text.RegularExpressions.Regex.IsMatch(text, @"^[a-zA-Zа-яА-ЯёЁ0-9 _\-]+$"))
        {
            _errorText.Text = Res.Validation_AllowedChars;
            _errorText.Foreground = ErrorColor;
            _errorText.Visibility = Visibility.Visible;
            return;
        }
        _errorText.Visibility = Visibility.Collapsed;
        GameName = text;
        DialogResult = true;
        Close();
    }

    private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            e.Handled = true;
            ValidateAndSave();
        }
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            DialogResult = false;
            Close();
        }
    }

    private void Window_PreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        if (_nameBox.IsFocused && e.OriginalSource != _nameBox)
        {
            FocusManager.SetFocusedElement(this, null);
            Keyboard.ClearFocus();
        }
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        _nameBox.Focus();
        _nameBox.SelectAll();
    }
}
