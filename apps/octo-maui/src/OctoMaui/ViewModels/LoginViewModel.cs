using System.Collections.ObjectModel;
using System.Windows.Input;
using OctoMaui.Models;
using OctoMaui.Services;

namespace OctoMaui.ViewModels;

public sealed class LoginViewModel : ViewModelBase, IDisposable
{
    private readonly IAuthService _auth;
    private readonly IThemeService _theme;
    private readonly IServerConfigService _server;
    private readonly EventHandler _themeChangedHandler;
    private readonly EventHandler _serverInfoChangedHandler;
    private bool _disposed;

    // Commands stored once (not re-created on each access) so that
    // ChangeCanExecute and binding identity remain predictable.
    private readonly ICommand _loginCommand;
    private readonly ICommand _toggleThemeCommand;
    private readonly ICommand _switchServerCommand;
    private readonly ICommand _loginWithOidcCommand;

    public LoginViewModel(IAuthService auth, IThemeService theme, IServerConfigService server)
    {
        _auth = auth;
        _theme = theme;
        _server = server;

        _loginCommand = CreateCommand(async () => await LoginAsync(), () => !IsBusy);
        _toggleThemeCommand = CreateCommand(async () => await ToggleThemeAsync());
        _switchServerCommand = CreateCommand(() => SwitchServer());
        _loginWithOidcCommand = CreateCommand<OidcProvider>(async p => await LoginWithOidcAsync(p!), _ => !IsBusy);

        _themeChangedHandler = (_, _) => MainThread.BeginInvokeOnMainThread(RefreshThemeLabel);
        _serverInfoChangedHandler = (_, _) => MainThread.BeginInvokeOnMainThread(RefreshOidcProviders);
        _theme.ThemeChanged += _themeChangedHandler;
        _server.ServerInfoChanged += _serverInfoChangedHandler;

        RefreshThemeLabel();
        RefreshOidcProviders();
    }

    // --- local login ---

    public string ThemeLabel { get => Get<string>(); set => Set(value); } = "主题";

    public string Username { get => Get<string>(); set => Set(value); }
    public string Password { get => Get<string>(); set => Set(value); }
    public string ErrorMessage { get => Get<string>(); set => Set(value); }
    public bool IsBusy { get => Get<bool>(); set => Set(value); }

    public ICommand LoginCommand => _loginCommand;
    public ICommand ToggleThemeCommand => _toggleThemeCommand;
    public ICommand SwitchServerCommand => _switchServerCommand;

    // --- OIDC / enterprise passport ---

    /// <summary>SSO providers advertised by the server's appconfig.</summary>
    public ObservableCollection<OidcProvider> OidcProviders { get; } = new();

    /// <summary>True when at least one OIDC provider is available.</summary>
    public bool HasOidcProviders { get => Get<bool>(); set => Set(value); }

    /// <summary>Status message during OIDC login (authcode / polling).</summary>
    public string OidcStatus
    {
        get => Get<string>();
        set
        {
            Set(value);
            OnPropertyChanged(nameof(HasOidcStatus));
        }
    }
    public bool HasOidcStatus => !string.IsNullOrWhiteSpace(OidcStatus);

    /// <summary>Parameterized command: receives an <see cref="OidcProvider"/>.</summary>
    public ICommand LoginWithOidcCommand => _loginWithOidcCommand;

    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Username) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "请输入用户名和密码";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            var ok = await _auth.LoginAsync(Username, Password);
            if (!ok)
                ErrorMessage = "登录失败，请检查用户名和密码";
        }
        catch (Exception ex)
        {
            ErrorMessage = $"登录异常: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoginWithOidcAsync(OidcProvider provider)
    {
        IsBusy = true;
        ErrorMessage = string.Empty;
        OidcStatus = string.Empty;

        var progress = new Progress<string>(msg => MainThread.BeginInvokeOnMainThread(() => OidcStatus = msg));
        try
        {
            var ok = await _auth.LoginWithOidcAsync(provider, progress);
            if (!ok && string.IsNullOrWhiteSpace(OidcStatus))
                ErrorMessage = "企业登录失败，请重试";
        }
        catch (Exception ex)
        {
            ErrorMessage = $"企业登录异常: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void RefreshOidcProviders()
    {
        OidcProviders.Clear();
        if (_server.ServerInfo is { } info)
        {
            foreach (var p in info.OidcProviders)
                OidcProviders.Add(p);
        }
        HasOidcProviders = OidcProviders.Count > 0;
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

    private static void SwitchServer()
    {
        Shell.Current.GoToAsync("//server-config");
    }

    // --- IDisposable ---

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _theme.ThemeChanged -= _themeChangedHandler;
        _server.ServerInfoChanged -= _serverInfoChangedHandler;
        GC.SuppressFinalize(this);
    }
}
