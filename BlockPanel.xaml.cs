using System.Windows;
using System.Windows.Controls;

namespace MiniRacingHUD;

public class BlockPanel : ContentControl
{
    static BlockPanel()
    {
        DefaultStyleKeyProperty.OverrideMetadata(
            typeof(BlockPanel), new FrameworkPropertyMetadata(typeof(BlockPanel)));
    }

    public object Header
    {
        get => GetValue(HeaderProperty);
        set => SetValue(HeaderProperty, value);
    }
    public static readonly DependencyProperty HeaderProperty =
        DependencyProperty.Register(nameof(Header), typeof(object), typeof(BlockPanel), new PropertyMetadata(""));
}
