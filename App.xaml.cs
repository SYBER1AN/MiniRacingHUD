using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Windows;
using Res = MiniRacingHUD.Properties.Resources;

namespace MiniRacingHUD;

public partial class App : Application
{
    private static Mutex? _mutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        HandleRestartAfterUpdate(e.Args);

        _mutex = new Mutex(true, "MiniRacingHUD", out bool createdNew);

        if (!createdNew)
        {
            MessageBox.Show(
                Res.Dialog_AlreadyRunning,
                Res.Dialog_AppTitle,
                MessageBoxButton.OK,
                MessageBoxImage.Information);
            _mutex.Close();
            _mutex = null;
            Shutdown();
            return;
        }

        base.OnStartup(e);

        // Устанавливаем язык ДО создания MainWindow, чтобы LocExtension получил правильную культуру
        try
        {
            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AppConfig.json");
            if (File.Exists(configPath))
            {
                var json = File.ReadAllText(configPath);
                if (!string.IsNullOrWhiteSpace(json))
                {
                    var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("Language", out var langEl))
                    {
                        var lang = langEl.GetString();
                        var culture = lang == "en"
                            ? new CultureInfo("en-US")
                            : new CultureInfo("ru-RU");
                        LocalizationManager.Initialize(culture);
                    }
                }
            }
        }
        catch { }

        if (LocalizationManager.CurrentCulture == CultureInfo.InvariantCulture)
        {
            var systemLang = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
            var culture = systemLang == "ru"
                ? new CultureInfo("ru-RU")
                : new CultureInfo("en-US");
            LocalizationManager.Initialize(culture);
        }

        new MainWindow().Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _mutex?.ReleaseMutex();
        _mutex?.Close();
        base.OnExit(e);
    }

    // Новый экземпляр после обновления ждёт выхода старого, затем убирает его файлы
    private static void HandleRestartAfterUpdate(string[] args)
    {
        for (var i = 0; i + 1 < args.Length; i++)
        {
            if (!string.Equals(args[i], "--wait-pid", StringComparison.OrdinalIgnoreCase)) continue;
            if (!int.TryParse(args[i + 1], out var pid) || pid <= 0) break;

            try
            {
                using var process = Process.GetProcessById(pid);
                process.WaitForExit(10000);
            }
            catch { }

            UpdateService.CleanupAfterRestart();
            break;
        }
    }
}

