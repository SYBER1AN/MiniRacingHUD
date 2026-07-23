using System;
using System.Globalization;
using System.Windows;
using System.Windows.Markup;
using MiniRacingHUD.Properties;

namespace MiniRacingHUD;

[MarkupExtensionReturnType(typeof(string))]
public class LocExtension : MarkupExtension
{
    public string Key { get; set; } = string.Empty;

    public LocExtension() { }

    public LocExtension(string key)
    {
        Key = key;
    }

    public override object ProvideValue(IServiceProvider serviceProvider)
    {
        if (string.IsNullOrEmpty(Key))
            return $"![{nameof(Key)}]";

        var provideValueTarget = serviceProvider?.GetService(typeof(IProvideValueTarget)) as IProvideValueTarget;
        if (provideValueTarget == null)
            return Resources.ResourceManager.GetString(Key) ?? $"![{Key}]";

        if (provideValueTarget.TargetObject is DependencyObject targetObject &&
            provideValueTarget.TargetProperty is DependencyProperty targetProperty)
        {
            var weakTarget = new WeakReference(targetObject);
            var weakProperty = targetProperty;

            var value = Resources.ResourceManager.GetString(Key) ?? $"![{Key}]";

            if (!weakTarget.IsAlive)
                return value;

            EventHandler<CultureInfo> handler = null!;
            handler = (_, _) =>
            {
                if (weakTarget.Target is DependencyObject target && weakProperty != null)
                {
                    var newValue = Resources.ResourceManager.GetString(Key) ?? $"![{Key}]";
                    target.SetValue(weakProperty, newValue);
                }
                else
                {
                    LocalizationManager.CultureChanged -= handler;
                }
            };

            LocalizationManager.CultureChanged += handler;

            return value;
        }

        return Resources.ResourceManager.GetString(Key) ?? $"![{Key}]";
    }
}
