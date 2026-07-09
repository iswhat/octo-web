using OctoMaui.Models;

namespace OctoMaui.Services;

public interface IAuthService
{
    bool IsAuthenticated { get; }
    string? Token { get; }
    User? CurrentUser { get; }

    /// <summary>Raised on the UI thread whenever login/logout happens.</summary>
    event EventHandler AuthStateChanged;

    /// <summary>Local username/password login (octo-server built-in user system).</summary>
    Task<bool> LoginAsync(string username, string password, CancellationToken ct = default);

    /// <summary>
    /// Enterprise passport / OIDC SSO login. Obtains an authcode, opens the
    /// IdP authorize URL in the system browser, and polls the server for
    /// completion. <paramref name="progress"/> receives status messages for
    /// UI feedback. Returns true on successful authentication.
    /// </summary>
    Task<bool> LoginWithOidcAsync(OidcProvider provider, IProgress<string>? progress = null, CancellationToken ct = default);

    Task LogoutAsync();
}
