using OctoMaui.Models;

namespace OctoMaui.Services;

public interface IApiService
{
    /// <summary>Current REST base URL the client is pointing at.</summary>
    string BaseUrl { get; }

    /// <summary>
    /// Switch the REST endpoint at runtime. Recreates the internal
    /// <see cref="HttpClient"/> with the new base address. Call this when the
    /// user changes the server domain via <see cref="IServerConfigService"/>.
    /// </summary>
    void UpdateBaseUrl(string url);

    /// <summary>
    /// Quick reachability check: returns true if the server responds with any
    /// HTTP status (even 401/404). Only connection failures return false.
    /// </summary>
    Task<bool> PingAsync(string url, CancellationToken ct = default);

    /// <summary>Authenticate and obtain a session token.</summary>
    Task<LoginResult> LoginAsync(string username, string password, CancellationToken ct = default);

    /// <summary>Fetch the authenticated user's profile.</summary>
    Task<User> GetCurrentUserAsync(string token, CancellationToken ct = default);

    /// <summary>List the user's channels.</summary>
    Task<List<Channel>> GetChannelsAsync(string token, CancellationToken ct = default);

    /// <summary>Load message history for a channel (newest last).</summary>
    Task<List<Message>> GetMessagesAsync(string token, string channelId, int limit = 50, long? beforeTimestamp = null, CancellationToken ct = default);

    /// <summary>Send a text message to a channel.</summary>
    Task<Message> SendMessageAsync(string token, string channelId, string content, CancellationToken ct = default);
}
