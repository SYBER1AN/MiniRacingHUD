using System;
using System.Diagnostics;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using Res = MiniRacingHUD.Properties.Resources;

namespace MiniRacingHUD;

public partial class UpdateDialog : Window
{
    private readonly UpdateInfo _info;
    private readonly TextBlock _header;
    private readonly TextBlock _versions;
    private readonly Border _notes;
    private readonly TextBlock _status;
    private readonly ProgressBar _progress;
    private readonly Button _primaryBtn;
    private readonly Button _secondaryBtn;
    private readonly Brush _secondaryBrush;
    private readonly Brush _redBrush;
    private readonly Brush _accentBrush;

    private CancellationTokenSource? _cts;
    private string? _workDir;
    private bool _applying;

    public UpdateDialog(UpdateInfo info, Window? owner)
    {
        _info = info;
        if (owner is { IsVisible: true }) Owner = owner;

        InitializeComponent();
        BaseDialogWindow.SetupWindow(this);
        // SetupWindow в конце фиксирует высоту; здесь возвращаем авто-высоту, чтобы
        // полоса загрузки и статус не выталкивали кнопки за нижний край
        SourceInitialized += (_, _) => SizeToContent = SizeToContent.Height;
        MinWidth = 520;

        shell.closeBtn.Click += (_, _) => CloseDialog();

        var textPrimary = TryFindResource("TextPrimaryBrush") as Brush ?? Brushes.Gainsboro;
        var inputBg = TryFindResource("InputBgBrush") as Brush ?? Brushes.Black;
        var accentBrush = TryFindResource("AccentBrush") as Brush ?? Brushes.LimeGreen;
        _accentBrush = accentBrush;
        var borderBrush = TryFindResource("BorderBrush") as Brush ?? Brushes.DimGray;
        _secondaryBrush = TryFindResource("TextSecondaryBrush") as Brush ?? Brushes.Gray;
        _redBrush = TryFindResource("RedBrush") as Brush ?? Brushes.IndianRed;

        _header = new TextBlock
        {
            Text = Res.Update_AvailableTitle,
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            Foreground = textPrimary,
            Margin = new Thickness(18, 4, 18, 0),
        };

        _versions = new TextBlock
        {
            Text = $"{UpdateService.CurrentVersion}  →  {info.Version}",
            FontSize = 12,
            Foreground = _secondaryBrush,
            Margin = new Thickness(18, 4, 18, 0),
        };

        var notesText = BuildNotesContent(info.Notes, textPrimary);

        _notes = new Border
        {
            Background = inputBg,
            BorderBrush = borderBrush,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(4),
            Margin = new Thickness(18, 12, 18, 0),
            Child = new ScrollViewer
            {
                Content = notesText,
                MaxHeight = 200,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            },
            Visibility = string.IsNullOrWhiteSpace(info.Notes) ? Visibility.Collapsed : Visibility.Visible,
        };

        _progress = new ProgressBar
        {
            Height = 8,
            Minimum = 0,
            Maximum = 100,
            Foreground = accentBrush,
            Background = inputBg,
            BorderBrush = borderBrush,
            BorderThickness = new Thickness(1),
            Margin = new Thickness(18, 12, 18, 0),
            Visibility = Visibility.Collapsed,
        };

        _status = new TextBlock
        {
            TextWrapping = TextWrapping.Wrap,
            FontSize = 11,
            Foreground = _secondaryBrush,
            Margin = new Thickness(18, 8, 18, 0),
            Visibility = Visibility.Collapsed,
        };

        _primaryBtn = new Button
        {
            Content = Res.Update_ButtonGo,
            Style = (Style)TryFindResource("GreenButton")!,
            Width = 140,
            Height = 32,
        };
        _primaryBtn.Click += async (_, _) => await PrimaryClickAsync();

        _secondaryBtn = new Button
        {
            Content = Res.Update_ButtonLater,
            Style = (Style)TryFindResource("GrayButton")!,
            Width = 140,
            Height = 32,
        };
        _secondaryBtn.Click += (_, _) => CloseDialog();

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(18, 16, 18, 4),
        };
        buttons.Children.Add(_primaryBtn);
        buttons.Children.Add(new Border { Width = 14 });
        buttons.Children.Add(_secondaryBtn);

        var content = new StackPanel();
        content.Children.Add(_header);
        content.Children.Add(_versions);
        content.Children.Add(_notes);
        content.Children.Add(_progress);
        content.Children.Add(_status);
        content.Children.Add(buttons);
        shell.contentArea.Content = content;

        Closed += (_, _) => _cts?.Cancel();
    }

    // Подмножество Markdown из описаний релизов: заголовки, списки, **жирный**,
    // *курсив*, `код`, ссылки и разделители. Таблицы и картинки не поддерживаются.
    private FrameworkElement BuildNotesContent(string notes, Brush foreground)
    {
        var panel = new StackPanel { Margin = new Thickness(10, 7, 10, 7) };

        foreach (var rawLine in notes.Replace("\r\n", "\n").Split('\n'))
        {
            var line = rawLine.TrimEnd();
            if (line.Length == 0)
            {
                panel.Children.Add(new Border { Height = 6 });
                continue;
            }
            if (line.Trim() == "---")
            {
                panel.Children.Add(new Border
                {
                    Height = 1,
                    Background = _secondaryBrush,
                    Margin = new Thickness(0, 6, 0, 6),
                });
                continue;
            }

            var headingLevel = 0;
            while (headingLevel < line.Length && line[headingLevel] == '#') headingLevel++;
            if (headingLevel is > 0 and <= 6 && headingLevel < line.Length && line[headingLevel] == ' ')
            {
                panel.Children.Add(CreateNotesLine(line[(headingLevel + 1)..].Trim(), foreground, heading: true));
                continue;
            }

            var isBullet = line.StartsWith("- ") || line.StartsWith("* ") || line.StartsWith("+ ");
            panel.Children.Add(CreateNotesLine(isBullet ? line[2..] : line, foreground, bullet: isBullet));
        }

        return panel;
    }

    private TextBlock CreateNotesLine(string text, Brush foreground, bool heading = false, bool bullet = false)
    {
        var block = new TextBlock
        {
            TextWrapping = TextWrapping.Wrap,
            FontSize = heading ? 13 : 12,
            FontWeight = heading ? FontWeights.Bold : FontWeights.Normal,
            Foreground = foreground,
            Margin = new Thickness(bullet ? 12 : 0, heading ? 6 : 0, 0, heading ? 2 : 1),
        };
        if (bullet) block.Inlines.Add(new Run("•  "));
        AddInlineMarkup(block, text);
        return block;
    }

    private void AddInlineMarkup(TextBlock block, string text)
    {
        var plain = new StringBuilder();
        void Flush()
        {
            if (plain.Length == 0) return;
            block.Inlines.Add(new Run(plain.ToString()));
            plain.Clear();
        }

        var i = 0;
        while (i < text.Length)
        {
            var c = text[i];

            if (c == '`')
            {
                var end = text.IndexOf('`', i + 1);
                if (end > i + 1)
                {
                    Flush();
                    block.Inlines.Add(new Run(text[(i + 1)..end]) { FontFamily = new FontFamily("Consolas") });
                    i = end + 1;
                    continue;
                }
            }
            else if (c == '[')
            {
                var close = text.IndexOf(']', i + 1);
                if (close > i + 1 && close + 1 < text.Length && text[close + 1] == '(')
                {
                    var paren = text.IndexOf(')', close + 2);
                    if (paren > close + 2)
                    {
                        var url = text[(close + 2)..paren];
                        if (Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
                            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                        {
                            Flush();
                            var link = new Hyperlink(new Run(text[(i + 1)..close]))
                            {
                                Foreground = _accentBrush,
                                Cursor = Cursors.Hand,
                            };
                            link.RequestNavigate += (_, e) =>
                            {
                                try { Process.Start(new ProcessStartInfo(e.Uri.AbsoluteUri) { UseShellExecute = true }); }
                                catch { }
                            };
                            block.Inlines.Add(link);
                            i = paren + 1;
                            continue;
                        }
                    }
                }
            }
            else if (c == '*' && i + 1 < text.Length && text[i + 1] == '*')
            {
                var end = text.IndexOf("**", i + 2, StringComparison.Ordinal);
                if (end > i + 2)
                {
                    Flush();
                    block.Inlines.Add(new Run(text[(i + 2)..end]) { FontWeight = FontWeights.Bold });
                    i = end + 2;
                    continue;
                }
            }
            else if (c == '*')
            {
                var end = text.IndexOf('*', i + 1);
                if (end > i + 1)
                {
                    Flush();
                    block.Inlines.Add(new Run(text[(i + 1)..end]) { FontStyle = FontStyles.Italic });
                    i = end + 1;
                    continue;
                }
            }

            plain.Append(c);
            i++;
        }

        Flush();
    }

    private async Task PrimaryClickAsync()
    {
        await DownloadAsync();
    }

    private async Task DownloadAsync()
    {
        _cts?.Cancel();
        _cts = new CancellationTokenSource();
        var ct = _cts.Token;

        _workDir = null;
        _primaryBtn.Visibility = Visibility.Collapsed;
        _secondaryBtn.Content = Res.Update_ButtonCancel;
        _secondaryBtn.Visibility = Visibility.Visible;
        _progress.IsIndeterminate = false;
        _progress.Value = 0;
        _progress.Visibility = Visibility.Visible;
        _status.Foreground = _secondaryBrush;
        _status.Text = "";
        _status.Visibility = Visibility.Visible;

        var progress = new Progress<(long received, long total)>(p =>
        {
            var total = p.total > 0 ? p.total : _info.Size;
            _progress.Value = total > 0 ? Math.Min(100.0, p.received * 100.0 / total) : 0;
            _status.Text = string.Format(Res.Update_DownloadedFormat, p.received / 1048576.0, total / 1048576.0);
        });

        try
        {
            _workDir = await UpdateService.DownloadAsync(_info, progress, ct);
        }
        catch (OperationCanceledException)
        {
            _workDir = null;
            ResetToIdle();
            return;
        }
        catch (Exception ex)
        {
            _workDir = null;
            ShowError(string.Format(Res.Update_ErrorDownload, ex.Message));
            return;
        }

        await InstallAsync();
    }

    private async Task InstallAsync()
    {
        if (_workDir == null) return;

        _applying = true;
        _primaryBtn.Visibility = Visibility.Collapsed;
        _secondaryBtn.Visibility = Visibility.Collapsed;
        _progress.IsIndeterminate = true;
        _progress.Value = 0;
        _status.Foreground = _secondaryBrush;
        _status.Text = Res.Update_Unpacking;
        _status.Visibility = Visibility.Visible;

        var progress = new Progress<(UpdateStage stage, double percent)>(p =>
        {
            switch (p.stage)
            {
                case UpdateStage.Unpacking:
                    if (!_progress.IsIndeterminate) _progress.IsIndeterminate = true;
                    _status.Text = Res.Update_Unpacking;
                    break;
                case UpdateStage.Installing:
                    if (_progress.IsIndeterminate)
                    {
                        _progress.IsIndeterminate = false;
                        _progress.Value = 0;
                    }
                    _progress.Value = p.percent;
                    _status.Text = Res.Update_Installing;
                    break;
                case UpdateStage.Starting:
                    _progress.IsIndeterminate = false;
                    _progress.Value = 100;
                    _status.Text = Res.Update_Starting;
                    break;
            }
        });

        var workDir = _workDir;
        var (ok, error) = await Task.Run(() =>
        {
            var result = UpdateService.ApplyAndRestart(workDir, progress, out var err);
            return (result, err);
        });

        _applying = false;
        if (ok)
        {
            // Файлы заменены и новая копия запущена: окна убираем сразу,
            // штатное завершение (сохранение настроек, WebView2) идёт уже скрыто
            if (Owner is Window owner)
            {
                owner.Hide();
                Close();
                owner.Close();
            }
            else
            {
                Close();
                Application.Current.Shutdown();
            }
            return;
        }

        _workDir = null;
        ShowError(string.Format(Res.Update_ErrorApply, error));
    }

    private void ShowError(string message)
    {
        _progress.Visibility = Visibility.Collapsed;
        _status.Foreground = _redBrush;
        _status.Text = message;
        _status.Visibility = Visibility.Visible;
        _primaryBtn.Content = Res.Update_ButtonRetry;
        _primaryBtn.Visibility = Visibility.Visible;
        _primaryBtn.IsEnabled = true;
        _secondaryBtn.Content = Res.Update_ButtonClose;
        _secondaryBtn.Visibility = Visibility.Visible;
    }

    private void ResetToIdle()
    {
        _progress.Value = 0;
        _progress.IsIndeterminate = false;
        _progress.Visibility = Visibility.Collapsed;
        _status.Visibility = Visibility.Collapsed;
        _primaryBtn.Content = Res.Update_ButtonGo;
        _primaryBtn.Visibility = Visibility.Visible;
        _primaryBtn.IsEnabled = true;
        _secondaryBtn.Content = Res.Update_ButtonLater;
        _secondaryBtn.Visibility = Visibility.Visible;
    }

    private void CloseDialog()
    {
        if (_applying) return;
        _cts?.Cancel();
        Close();
    }

    private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            CloseDialog();
        }
    }
}
