using OctoMaui.Models;

namespace OctoMaui.Services;

public interface IApiService
{
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
