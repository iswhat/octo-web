using OctoMaui.Models;

namespace OctoMaui.Services;

public interface IAuthService
{
    bool IsAuthenticated { get; }
    string? Token { get; }
    User? CurrentUser { get; }

    /// <summary>Raised on the UI thread whenever login/logout happens.</summary>
    event EventHandler AuthStateChanged;

    Task<bool> LoginAsync(string username, string password, CancellationToken ct = default);
    Task LogoutAsync();
}
