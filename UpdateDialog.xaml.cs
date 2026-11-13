using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
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

        var notesText = new TextBlock
        {
            Text = info.Notes,
            TextWrapping = TextWrapping.Wrap,
            FontSize = 12,
            Foreground = textPrimary,
            Margin = new Thickness(10, 7, 10, 7),
        };

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
            Close();
            if (Owner is Window owner) owner.Close();
            else Application.Current.Shutdown();
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
