using OctoMaui.Models;

namespace OctoMaui.Services;

public interface IWebSocketService
{
    bool IsConnected { get; }

    /// <summary>A full chat message arrived from the server.</summary>
    event Action<Message>? MessageReceived;

    /// <summary>Channel list / unread state changed.</summary>
    event Action? ChannelUpdated;

    /// <summary>Connection dropped unexpectedly.</summary>
    event Action<Exception>? ConnectionClosed;

    Task ConnectAsync(string token, CancellationToken ct = default);
    Task DisconnectAsync();
    Task SendAsync(string channelId, string content, CancellationToken ct = default);
}
