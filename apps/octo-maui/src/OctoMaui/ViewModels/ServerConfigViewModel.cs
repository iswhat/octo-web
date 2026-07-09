using System.Windows.Input;
using OctoMaui.Services;

namespace OctoMaui.ViewModels;

/// <summary>
/// View model for the server configuration page. Lets the user enter a server
/// domain, test the connection, and save it. On success the app navigates to
/// the login page.
/// </summary>
public sealed class ServerConfigViewModel : ViewModelBase
{
    private readonly IServerConfigService _server;
    private readonly IThemeService _theme;

    public ServerConfigViewModel(IServerConfigService server, IThemeService theme)
    {
        _server = server;
        _theme = theme;

        // Pre-fill with the current URL if already configured.
        ServerUrl = _server.ServerUrl;

        TestCommand = CreateCommand(async () => await TestAsync(),
            () => !IsBusy && !string.IsNullOrWhiteSpace(ServerUrl));
        SaveCommand = CreateCommand(async () => await SaveAsync(),
            () => !IsBusy && !string.IsNullOrWhiteSpace(ServerUrl));
        ToggleThemeCommand = CreateCommand(async () => await ToggleThemeAsync());

        _theme.ThemeChanged += (_, _) => MainThread.BeginInvokeOnMainThread(RefreshThemeLabel);
        RefreshThemeLabel();
    }

    /// <summary>User-entered server domain / URL.</summary>
    public string ServerUrl
    {
        get => Get<string>();
        set
        {
            Set(value);
            ((Command)TestCommand).ChangeCanExecute();
            ((Command)SaveCommand).ChangeCanExecute();
        }
    }

    public bool IsBusy { get => Get<bool>(); set => Set(value); }

    /// <summary>Status message shown below the input (success / error).</summary>
    public string StatusMessage
    {
        get => Get<string>();
        set
        {
            Set(value);
            OnPropertyChanged(nameof(HasStatus));
        }
    }

    /// <summary>True when StatusMessage is non-empty (drives visibility).</summary>
    public bool HasStatus => !string.IsNullOrWhiteSpace(StatusMessage);

    /// <summary>True when the last test/save succeeded (drives text color).</summary>
    public bool IsSuccess { get => Get<bool>(); set => Set(value); }

    /// <summary>Localized label for the theme toggle button.</summary>
    public string ThemeLabel { get => Get<string>(); set => Set(value); } = "主题";

    public ICommand TestCommand { get; }
    public ICommand SaveCommand { get; }
    public ICommand ToggleThemeCommand { get; }

    private async Task TestAsync()
    {
        IsBusy = true;
        StatusMessage = "正在测试连接…";
        IsSuccess = false;
        try
        {
            var ok = await _server.ValidateAsync(ServerUrl);
            StatusMessage = ok ? "✓ 服务器可达" : "✗ 无法连接到服务器";
            IsSuccess = ok;
        }
        catch (Exception ex)
        {
            StatusMessage = $"✗ {ex.Message}";
            IsSuccess = false;
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SaveAsync()
    {
        IsBusy = true;
        StatusMessage = "正在保存…";
        IsSuccess = false;
        try
        {
            var ok = await _server.SetServerUrlAsync(ServerUrl);
            if (ok)
            {
                StatusMessage = "✓ 已保存，正在跳转…";
                IsSuccess = true;
                // The AppShell will navigate to login via ServerChanged event.
            }
            else
            {
                StatusMessage = "✗ 无法连接到服务器，请检查地址";
                IsSuccess = false;
            }
        }
        catch (Exception ex)
        {
            StatusMessage = $"✗ {ex.Message}";
            IsSuccess = false;
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ToggleThemeAsync()
    {
        var next = _theme.Mode switch
        {
            AppTheme.Unspecified => AppTheme.Light,
            AppTheme.Light => AppTheme.Dark,
            _ => AppTheme.Unspecified,
        };
        await _theme.SetModeAsync(next);
        RefreshThemeLabel();
    }

    private void RefreshThemeLabel()
    {
        ThemeLabel = _theme.Mode switch
        {
            AppTheme.Light => "浅色",
            AppTheme.Dark => "深色",
            _ => "跟随系统",
        };
    }
}
