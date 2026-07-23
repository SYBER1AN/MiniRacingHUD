using System.Windows;
using System.Windows.Media;

namespace MiniRacingHUD;

internal static class VisualTreeHelperEx
{
    internal static T? FindVisualChild<T>(DependencyObject parent) where T : DependencyObject
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

    internal static T? FindVisualChildByTag<T>(DependencyObject parent, object tag) where T : DependencyObject
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
}
