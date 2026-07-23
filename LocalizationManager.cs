using System;
using System.Globalization;
using System.Threading;

namespace MiniRacingHUD;

public static class LocalizationManager
{
    public static event EventHandler<CultureInfo>? CultureChanged;

    public static CultureInfo CurrentCulture { get; private set; } = CultureInfo.InvariantCulture;

    public static void ChangeCulture(CultureInfo culture)
    {
        if (culture == null)
            throw new ArgumentNullException(nameof(culture));

        if (Equals(CurrentCulture, culture))
            return;

        CurrentCulture = culture;
        Thread.CurrentThread.CurrentUICulture = culture;

        CultureChanged?.Invoke(null, culture);
    }

    public static void Initialize(CultureInfo culture)
    {
        CurrentCulture = culture;
        Thread.CurrentThread.CurrentUICulture = culture;
    }
}
