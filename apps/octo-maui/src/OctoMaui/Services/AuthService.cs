using OctoMaui.Models;

namespace OctoMaui.Services;

/// <summary>
/// Holds the current session. Persists the token to
/// <see cref="Preferences"/> so the user stays signed in across launches.
/// </summary>
public sealed class AuthService : IAuthService
{
    private const string TokenKey = "octo.auth.token";
    private readonly IApiService _api;

    private string? _token;
    private User? _user;

    public AuthService(IApiService api)
    {
        _api = api;
        _token = Preferences.Default.Get(TokenKey, (string?)null);
        // CurrentUser is fetched lazily on first authenticated call.
    }

    public bool IsAuthenticated => !string.IsNullOrWhiteSpace(_token);

    public string? Token => _token;

    public User? CurrentUser => _user;

    public event EventHandler? AuthStateChanged;

    public async Task<bool> LoginAsync(string username, string password, CancellationToken ct = default)
    {
        try
        {
            var result = await _api.LoginAsync(username, password, ct);
            _token = result.Token;
            _user = result.User;
            Preferences.Default.Set(TokenKey, _token);
            RaiseChanged();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task LogoutAsync()
    {
        _token = null;
        _user = null;
        Preferences.Default.Remove(TokenKey);
        RaiseChanged();
        await Task.CompletedTask;
    }

    /// <summary>Hydrate CurrentUser after a cold start when a saved token exists.</summary>
    public async Task<bool> HydrateCurrentUserAsync(CancellationToken ct = default)
    {
        if (!IsAuthenticated) return false;
        try
        {
            _user = await _api.GetCurrentUserAsync(_token!, ct);
            return true;
        }
        catch
        {
            // Token invalid — force logout.
            await LogoutAsync();
            return false;
        }
    }

    private void RaiseChanged()
        => MainThread.BeginInvokeOnMainThread(
            () => AuthStateChanged?.Invoke(this, EventArgs.Empty));
}
