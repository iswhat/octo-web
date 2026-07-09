namespace OctoMaui.Services;

/// <summary>
/// Manages the user-configurable octo-server endpoint. Because octo-web is an
/// open-source project, the server domain is not known at build time — the
/// user must be able to point the client at whichever instance they want to
/// connect to. The chosen URL is persisted across launches.
/// </summary>
public interface IServerConfigService
{
    /// <summary>
    /// The normalized server origin currently in use (e.g.
    /// <c>https://octo.example.com</c>). Empty string when not yet configured.
    /// </summary>
    string ServerUrl { get; }

    /// <summary>True when a server URL has been saved.</summary>
    bool IsConfigured { get; }

    /// <summary>Raised on the UI thread when the server URL changes.</summary>
    event EventHandler? ServerChanged;

    /// <summary>
    /// Load the saved URL from preferences into <see cref="ApiOptions"/> /
    /// <see cref="IApiService"/>. Call once at startup before any navigation.
    /// </summary>
    Task InitializeAsync();

    /// <summary>
    /// Validate, persist, and apply a new server URL. Returns false (with
    /// <paramref name="errorMessage"/> set) if the server is unreachable.
    /// </summary>
    Task<bool> SetServerUrlAsync(string url, CancellationToken ct = default);

    /// <summary>
    /// Test whether <paramref name="url"/> is reachable without saving it.
    /// Returns true if the server responds with any HTTP status.
    /// </summary>
    Task<bool> ValidateAsync(string url, CancellationToken ct = default);
}
