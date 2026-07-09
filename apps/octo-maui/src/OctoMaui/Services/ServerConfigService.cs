using OctoMaui.Models;

namespace OctoMaui.Services;

/// <summary>
/// Persists the user's chosen octo-server URL in <see cref="Preferences"/> and
/// keeps <see cref="ApiOptions"/> / <see cref="IApiService"/> in sync. After
/// connecting, also probes <c>/v1/common/appconfig</c> for OIDC/SSO provider
/// configuration so the login page can show enterprise passport buttons.
/// </summary>
public sealed class ServerConfigService : IServerConfigService
{
    private const string PrefKey = "server.url";

    private readonly ApiOptions _options;
    private readonly IApiService _api;

    public ServerConfigService(ApiOptions options, IApiService api)
    {
        _options = options;
        _api = api;
    }

    /// <inheritdoc />
    public string ServerUrl { get; private set; } = string.Empty;

    /// <inheritdoc />
    public bool IsConfigured => !string.IsNullOrWhiteSpace(ServerUrl);

    /// <inheritdoc />
    public ServerInfo? ServerInfo { get; private set; }

    /// <inheritdoc />
    public event EventHandler? ServerChanged;

    /// <inheritdoc />
    public event EventHandler? ServerInfoChanged;

    /// <inheritdoc />
    public async Task InitializeAsync()
    {
        var saved = Preferences.Default.Get(PrefKey, string.Empty);
        if (!string.IsNullOrWhiteSpace(saved))
        {
            try
            {
                var normalized = ApiService.NormalizeUrl(saved);
                ServerUrl = normalized;
                _options.BaseUrl = normalized;
                _api.UpdateBaseUrl(normalized);
            }
            catch
            {
                // Corrupted preference — clear it so the user is prompted again.
                Preferences.Default.Remove(PrefKey);
                return;
            }
        }

        // Probe capabilities (OIDC providers etc.) if a server is configured.
        await ProbeServerInfoAsync();
    }

    /// <inheritdoc />
    public async Task<bool> SetServerUrlAsync(string url, CancellationToken ct = default)
    {
        string normalized;
        try
        {
            normalized = ApiService.NormalizeUrl(url);
        }
        catch (ArgumentException)
        {
            return false;
        }

        // Validate reachability before committing.
        if (!await _api.PingAsync(normalized, ct))
            return false;

        ServerUrl = normalized;
        _options.BaseUrl = normalized;
        _api.UpdateBaseUrl(normalized);
        Preferences.Default.Set(PrefKey, normalized);

        RaiseChanged();

        // Probe appconfig for OIDC providers (non-fatal if it fails).
        await ProbeServerInfoAsync();

        return true;
    }

    /// <inheritdoc />
    public Task<bool> ValidateAsync(string url, CancellationToken ct = default)
    {
        return _api.PingAsync(url, ct);
    }

    // --- helpers ---

    private async Task ProbeServerInfoAsync()
    {
        if (!IsConfigured) return;
        try
        {
            ServerInfo = await _api.GetServerInfoAsync();
        }
        catch
        {
            ServerInfo = new ServerInfo();
        }
        RaiseInfoChanged();
    }

    private void RaiseChanged()
        => MainThread.BeginInvokeOnMainThread(
            () => ServerChanged?.Invoke(this, EventArgs.Empty));

    private void RaiseInfoChanged()
        => MainThread.BeginInvokeOnMainThread(
            () => ServerInfoChanged?.Invoke(this, EventArgs.Empty));
}
