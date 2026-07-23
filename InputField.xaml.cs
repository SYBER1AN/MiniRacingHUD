using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace MiniRacingHUD;

public partial class InputField : UserControl
{
    public InputField()
    {
        InitializeComponent();
        Height = 24;
        FontSize = 13;
        inputBox.TextChanged += (_, _) =>
        {
            SetCurrentValue(TextProperty, inputBox.Text);
        };
    }

    public string Label
    {
        get => (string)GetValue(LabelProperty);
        set => SetValue(LabelProperty, value);
    }
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(InputField), new PropertyMetadata(""));

    public string Text
    {
        get => (string)GetValue(TextProperty);
        set => SetValue(TextProperty, value);
    }
    public static readonly DependencyProperty TextProperty =
        DependencyProperty.Register(nameof(Text), typeof(string), typeof(InputField),
            new FrameworkPropertyMetadata("", FrameworkPropertyMetadataOptions.BindsTwoWayByDefault, OnTextChanged));

    private static void OnTextChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var field = (InputField)d;
        if (field.inputBox.Text != (string)e.NewValue)
            field.inputBox.Text = (string)e.NewValue;
    }

    public double LabelFontSize
    {
        get => (double)GetValue(LabelFontSizeProperty);
        set => SetValue(LabelFontSizeProperty, value);
    }
    public static readonly DependencyProperty LabelFontSizeProperty =
        DependencyProperty.Register(nameof(LabelFontSize), typeof(double), typeof(InputField),         new PropertyMetadata(11.0));

    public double InputWidth
    {
        get => (double)GetValue(InputWidthProperty);
        set => SetValue(InputWidthProperty, value);
    }
    public static readonly DependencyProperty InputWidthProperty =
        DependencyProperty.Register(nameof(InputWidth), typeof(double), typeof(InputField), new PropertyMetadata(double.NaN));

    public int MaxLength
    {
        get => (int)GetValue(MaxLengthProperty);
        set => SetValue(MaxLengthProperty, value);
    }
    public static readonly DependencyProperty MaxLengthProperty =
        DependencyProperty.Register(nameof(MaxLength), typeof(int), typeof(InputField), new PropertyMetadata(0));

    public string ToolTipText
    {
        get => (string)GetValue(ToolTipTextProperty);
        set => SetValue(ToolTipTextProperty, value);
    }
    public static readonly DependencyProperty ToolTipTextProperty =
        DependencyProperty.Register(nameof(ToolTipText), typeof(string), typeof(InputField), new PropertyMetadata("", (d, _) =>
        {
            var field = (InputField)d;
            field.labelBlock.ToolTip = field.ToolTipText;
        }));

    public TextAlignment TextAlignment
    {
        get => (TextAlignment)GetValue(TextAlignmentProperty);
        set => SetValue(TextAlignmentProperty, value);
    }
    public static readonly DependencyProperty TextAlignmentProperty =
        DependencyProperty.Register(nameof(TextAlignment), typeof(TextAlignment), typeof(InputField), new PropertyMetadata(TextAlignment.Left));

    public new Thickness Padding
    {
        get => (Thickness)GetValue(PaddingProperty);
        set => SetValue(PaddingProperty, value);
    }
    public static readonly new DependencyProperty PaddingProperty =
        DependencyProperty.Register(nameof(Padding), typeof(Thickness), typeof(InputField), new PropertyMetadata(new Thickness(6, 3, 6, 3)));

    public Cursor LabelCursor
    {
        get => (Cursor)GetValue(LabelCursorProperty);
        set => SetValue(LabelCursorProperty, value);
    }
    public static readonly DependencyProperty LabelCursorProperty =
        DependencyProperty.Register(nameof(LabelCursor), typeof(Cursor), typeof(InputField), new PropertyMetadata(Cursors.Hand));

    public Thickness LabelMargin
    {
        get => (Thickness)GetValue(LabelMarginProperty);
        set => SetValue(LabelMarginProperty, value);
    }
    public static readonly DependencyProperty LabelMarginProperty =
        DependencyProperty.Register(nameof(LabelMargin), typeof(Thickness), typeof(InputField), new PropertyMetadata(new Thickness(0, 0, 6, 0)));

    public TextBox InputTextBox => inputBox;

    private void Label_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left)
        {
            inputBox.Focus();
            inputBox.SelectAll();
            e.Handled = true;
        }
    }
}
