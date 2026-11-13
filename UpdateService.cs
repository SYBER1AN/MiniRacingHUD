using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Res = MiniRacingHUD.Properties.Resources;

namespace MiniRacingHUD;

public sealed class UpdateInfo
{
    public string Version { get; init; } = "";
    public string Notes { get; init; } = "";
    public string DownloadUrl { get; init; } = "";
    public long Size { get; init; }
}

public enum UpdateStage
{
    Unpacking,
    Installing,
    Starting
}

public static class UpdateService
{
    private const string RepoOwner = "SYBER1AN";
    private const string RepoName = "MiniRacingHUD";
    private const string AssetName = "MiniRacingHUD.zip";
    private const string ExeName = "MiniRacingHUD.exe";
    private const string OldExeName = "MiniRacingHUD.old.exe";
    private const string TempFolderName = "MiniRacingHUD_update";

    private static readonly HttpClient Http = CreateHttpClient();

    private static HttpClient CreateHttpClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("MiniRacingHUD-Updater");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        return client;
    }

    private static string AppDir => AppContext.BaseDirectory;

    // Автообновление включаем только для опубликованной Release-сборки
    public static bool IsSupported
    {
        get
        {
#if DEBUG
            return false;
#else
            var exe = Environment.ProcessPath;
            if (exe == null || !string.Equals(Path.GetFileName(exe), ExeName, StringComparison.OrdinalIgnoreCase))
                return false;
            // У обычной сборки рядом лежат dll и runtimeconfig.json; в single-file публикации их нет
            if (File.Exists(Path.Combine(AppDir, "MiniRacingHUD.dll")) ||
                File.Exists(Path.Combine(AppDir, "MiniRacingHUD.runtimeconfig.json")))
                return false;
            return File.Exists(Path.Combine(AppDir, "Widget", "MiniRacingHUD.html"));
#endif
        }
    }

    public static string CurrentVersion =>
        typeof(UpdateService).Assembly.GetName().Version?.ToString() ?? "0.0.0.0";

    // null — обновления нет, сеть недоступна или релиз без нужного файла
    public static async Task<UpdateInfo?> CheckAsync(CancellationToken ct = default)
    {
        if (!IsSupported) return null;

        try
        {
            if (!Version.TryParse(CurrentVersion, out var current)) return null;

            var url = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases?per_page=30";
            using var response = await Http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return null;

            var releases = new List<ReleaseEntry>();
            foreach (var release in doc.RootElement.EnumerateArray())
            {
                if (IsTrue(release, "draft") || IsTrue(release, "prerelease")) continue;

                var tag = release.TryGetProperty("tag_name", out var tagEl) ? tagEl.GetString() ?? "" : "";
                var versionText = tag.TrimStart('v', 'V');
                if (!Version.TryParse(versionText, out var version)) continue;
                if (!IsNewer(version, current)) continue;

                string? downloadUrl = null;
                long size = 0;
                if (release.TryGetProperty("assets", out var assets))
                {
                    foreach (var asset in assets.EnumerateArray())
                    {
                        var name = asset.TryGetProperty("name", out var n) ? n.GetString() : null;
                        if (!string.Equals(name, AssetName, StringComparison.OrdinalIgnoreCase)) continue;
                        downloadUrl = asset.TryGetProperty("browser_download_url", out var u) ? u.GetString() : null;
                        if (asset.TryGetProperty("size", out var s) && s.TryGetInt64(out var parsed)) size = parsed;
                        break;
                    }
                }

                var body = release.TryGetProperty("body", out var bodyEl) ? bodyEl.GetString() ?? "" : "";
                releases.Add(new ReleaseEntry(versionText, Normalize(version), body.Trim(), downloadUrl, size));
            }

            // Устанавливаемся на самый новый релиз, у которого есть архив
            var target = releases
                .Where(r => !string.IsNullOrEmpty(r.DownloadUrl))
                .OrderByDescending(r => r.Version)
                .FirstOrDefault();
            if (target == null) return null;

            // Заметки — по всем версиям между текущей и целевой, от новой к старой
            var notes = new StringBuilder();
            foreach (var release in releases
                         .Where(r => r.Version <= target.Version)
                         .OrderByDescending(r => r.Version))
            {
                if (notes.Length > 0) notes.Append("\n\n");
                notes.Append('v').Append(release.VersionText);
                if (release.Body.Length > 0) notes.Append('\n').Append(release.Body);
            }

            return new UpdateInfo
            {
                Version = target.VersionText,
                Notes = notes.ToString().Trim(),
                DownloadUrl = target.DownloadUrl!,
                Size = target.Size
            };
        }
        catch
        {
            return null;
        }
    }

    private sealed record ReleaseEntry(string VersionText, Version Version, string Body, string? DownloadUrl, long Size);

    private static bool IsTrue(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.True;

    private static bool IsNewer(Version remote, Version current)
    {
        var r = Normalize(remote);
        var c = Normalize(current);
        return r > c;
    }

    private static Version Normalize(Version v) => new(v.Major, v.Minor, Math.Max(v.Build, 0), Math.Max(v.Revision, 0));

    // Возвращает папку с архивом; распаковка и подмена файлов — в ApplyAndRestart
    public static async Task<string> DownloadAsync(
        UpdateInfo info,
        IProgress<(long received, long total)> progress,
        CancellationToken ct)
    {
        var rootDir = Path.Combine(Path.GetTempPath(), TempFolderName);
        if (Directory.Exists(rootDir)) Directory.Delete(rootDir, true);
        var workDir = Path.Combine(rootDir, info.Version);
        Directory.CreateDirectory(workDir);

        var zipPath = Path.Combine(workDir, AssetName);

        try
        {
            long total;
            using (var response = await Http.GetAsync(info.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, ct))
            {
                response.EnsureSuccessStatusCode();
                total = response.Content.Headers.ContentLength ?? info.Size;

                await using var source = await response.Content.ReadAsStreamAsync(ct);
                // Поток записи закрываем до выхода из метода, иначе архив останется занятым
                await using (var target = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
                {
                    var buffer = new byte[81920];
                    long received = 0;
                    int read;
                    while ((read = await source.ReadAsync(buffer, ct)) > 0)
                    {
                        await target.WriteAsync(buffer.AsMemory(0, read), ct);
                        received += read;
                        progress.Report((received, total));
                    }
                }
            }

            return workDir;
        }
        catch
        {
            TryDeleteDir(workDir);
            throw;
        }
    }

    // Распаковывает архив, подменяет файлы и запускает новую копию, которая ждёт выхода текущего процесса
    public static bool ApplyAndRestart(string workDir, IProgress<(UpdateStage stage, double percent)>? progress, out string error)
    {
        error = "";
        try
        {
            var exePath = Environment.ProcessPath;
            if (exePath == null)
            {
                error = Res.Update_ErrorNoExePath;
                return false;
            }

            var appDir = AppDir;

            var probePath = Path.Combine(appDir, ".update_probe");
            try
            {
                File.WriteAllText(probePath, "1");
                File.Delete(probePath);
            }
            catch
            {
                error = Res.Update_ErrorNoWriteAccess;
                return false;
            }

            progress?.Report((UpdateStage.Unpacking, 0));
            var unpackDir = Path.Combine(workDir, "unpacked");
            if (Directory.Exists(unpackDir)) Directory.Delete(unpackDir, true);
            ExtractWithProgress(Path.Combine(workDir, AssetName), unpackDir, progress);

            var newExe = Path.Combine(unpackDir, ExeName);
            if (!File.Exists(newExe))
            {
                error = Res.Update_ErrorBadPackage;
                return false;
            }

            var oldExe = Path.Combine(appDir, OldExeName);
            if (File.Exists(oldExe))
            {
                try { File.Delete(oldExe); }
                catch (Exception ex) { error = ex.Message; return false; }
            }

            File.Move(exePath, oldExe);

            var copies = new (string source, string destination)[]
            {
                (newExe, exePath),
                (Path.Combine(unpackDir, "Widget", "MiniRacingHUD.html"), Path.Combine(appDir, "Widget", "MiniRacingHUD.html")),
                (Path.Combine(unpackDir, "Widget", "bg.png"), Path.Combine(appDir, "Widget", "bg.png")),
                (Path.Combine(unpackDir, "README.md"), Path.Combine(appDir, "README.md")),
            };

            long totalBytes = 0;
            foreach (var (source, _) in copies)
                if (File.Exists(source)) totalBytes += new FileInfo(source).Length;

            progress?.Report((UpdateStage.Installing, 0));
            try
            {
                long copied = 0;
                foreach (var (source, destination) in copies)
                {
                    if (!File.Exists(source)) continue;
                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    var size = new FileInfo(source).Length;
                    CopyWithProgress(source, destination, copied, totalBytes, progress);
                    copied += size;
                }
            }
            catch
            {
                try { File.Move(oldExe, exePath); } catch { }
                throw;
            }

            progress?.Report((UpdateStage.Starting, 100));
            Process.Start(new ProcessStartInfo(exePath, $"--wait-pid {Environment.ProcessId}")
            {
                UseShellExecute = false,
                WorkingDirectory = appDir
            });

            // Временную папку убирает уже новая копия при старте — здесь удаление
            // ~230 МБ задерживает закрытие окон на несколько секунд
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private static void ExtractWithProgress(
        string zipPath,
        string destination,
        IProgress<(UpdateStage stage, double percent)>? progress)
    {
        using var archive = ZipFile.OpenRead(zipPath);
        var root = Path.GetFullPath(destination);
        var rootWithSep = root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        Directory.CreateDirectory(root);

        var entries = archive.Entries;
        for (var i = 0; i < entries.Count; i++)
        {
            var entry = entries[i];
            var target = Path.GetFullPath(Path.Combine(root, entry.FullName));
            if (!target.Equals(root, StringComparison.OrdinalIgnoreCase) &&
                !target.StartsWith(rootWithSep, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException(Res.Update_ErrorBadPackage);

            if (entry.FullName.EndsWith('/') || entry.FullName.EndsWith('\\'))
            {
                Directory.CreateDirectory(target);
            }
            else
            {
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                entry.ExtractToFile(target, true);
            }

            progress?.Report((UpdateStage.Unpacking, (i + 1) * 100.0 / entries.Count));
        }
    }

    private static void CopyWithProgress(
        string source,
        string destination,
        long alreadyCopied,
        long totalBytes,
        IProgress<(UpdateStage stage, double percent)>? progress)
    {
        using var input = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.Read, 81920);
        using var output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None, 81920);
        var buffer = new byte[81920];
        long done = 0;
        int read;
        while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
        {
            output.Write(buffer, 0, read);
            done += read;
            if (totalBytes > 0)
                progress?.Report((UpdateStage.Installing, (alreadyCopied + done) * 100.0 / totalBytes));
        }
    }

    public static void CleanupAfterRestart()
    {
        try
        {
            var oldExe = Path.Combine(AppDir, OldExeName);
            if (File.Exists(oldExe))
            {
                for (var attempt = 0; attempt < 5; attempt++)
                {
                    try { File.Delete(oldExe); break; }
                    catch { Thread.Sleep(300); }
                }
            }

            TryDeleteDir(Path.Combine(Path.GetTempPath(), TempFolderName));
        }
        catch { }
    }

    private static void TryDeleteDir(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, true);
        }
        catch { }
    }
}
