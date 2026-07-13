using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using OctoMaui.Models;

namespace OctoMaui.Services;

/// <summary>
/// Real-time client over octo-server WebSocket. Receives pushed messages,
/// presence, and channel updates; sends outgoing chat text.
/// </summary>
/// <remarks>
/// WIP: The octo-server uses <b>WuKongIM</b> for real-time messaging, not a
/// plain JSON-over-/ws endpoint. The IM address is obtained via
/// <c>GET /v1/users/:uid/im</c> and the WuKongIM SDK uses a cmd-based
/// binary protocol (not the JSON envelope assumed here). This implementation
/// is a scaffold and will be replaced by a WuKongIM .NET client when
/// available. See the README "Limitations" section.
/// </remarks>
public sealed class WebSocketService : IWebSocketService, IAsyncDisposable
{
    private readonly ApiOptions _options;
    private ClientWebSocket? _socket;
    private CancellationTokenSource? _cts;
    private Task? _receiveLoop;
    private readonly SemaphoreSlim _connectionLock = new(1, 1);

    public WebSocketService(ApiOptions options) => _options = options;

    public bool IsConnected => _socket?.State == WebSocketState.Open;

    public event Action<Message>? MessageReceived;
    public event Action<string, string>? StreamChunkReceived;  // (messageId, chunk)
    public event Action<string>? StreamStarted;  // messageId
    public event Action<string>? StreamEnded;    // messageId
    public event Action? ChannelUpdated;
    public event Action<Exception>? ConnectionClosed;

    public async Task ConnectAsync(string token, CancellationToken ct = default)
    {
        await _connectionLock.WaitAsync(ct);
        try
        {
            if (IsConnected) return;

            _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            _socket = new ClientWebSocket();
            _socket.Options.SetRequestHeader("token", token);

            // Token is sent only via the `token` header — NOT in the URL
            // query string, which would leak into server/proxy access logs.
            await _socket.ConnectAsync(new Uri(_options.WebSocketUrl), _cts.Token);

            _receiveLoop = Task.Run(ReceiveLoopAsync, _cts.Token);
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    public async Task DisconnectAsync()
    {
        await _connectionLock.WaitAsync();
        try
        {
            _cts?.Cancel();
            if (_receiveLoop is { } loop)
            {
                try { await loop; } catch { /* cancellation expected */ }
            }
            if (_socket is null) return;
            try
            {
                if (_socket.State == WebSocketState.Open)
                    await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "client closing", CancellationToken.None);
            }
            catch { /* ignore close errors */ }
            _socket.Dispose();
            _socket = null;
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    public async Task SendAsync(string channelId, string content, CancellationToken ct = default)
    {
        if (_socket is null || !IsConnected)
            throw new InvalidOperationException("WebSocket not connected.");

        var payload = JsonSerializer.Serialize(new
        {
            type = "message",
            channel_id = channelId,
            content,
            message_type = (int)MessageType.Text,
        });
        var bytes = Encoding.UTF8.GetBytes(payload);
        await _socket.SendAsync(bytes, WebSocketMessageType.Text, endOfMessage: true, ct);
    }

    private async Task ReceiveLoopAsync()
    {
        var buffer = new byte[65536];
        const int MaxMessageSize = 1 * 1024 * 1024;  // 1 MB — close if exceeded
        try
        {
            while (!_cts!.IsCancellationRequested && _socket!.State == WebSocketState.Open)
            {
                // Accumulate raw bytes across fragments and decode once after
                // EndOfMessage. Per-frame Encoding.UTF8.GetString is stateless
                // and would corrupt multi-byte chars (CJK/emoji) split across
                // the 64 KB buffer boundary.
                using var ms = new MemoryStream();
                WebSocketReceiveResult result;
                do
                {
                    result = await _socket.ReceiveAsync(buffer, _cts.Token);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        ConnectionClosed?.Invoke(new InvalidOperationException("Server closed the connection."));
                        return;
                    }
                    ms.Write(buffer, 0, result.Count);
                    // Guard against unbounded memory growth from a hostile or
                    // buggy server streaming an oversized message.
                    if (ms.Length > MaxMessageSize)
                    {
                        ConnectionClosed?.Invoke(new InvalidOperationException(
                            $"WebSocket message exceeded {MaxMessageSize / 1024}KB limit."));
                        try
                        {
                            await _socket.CloseAsync(WebSocketCloseStatus.MessageTooBig,
                                "Message size limit exceeded", CancellationToken.None);
                        }
                        catch { /* ignore close errors */ }
                        return;
                    }
                } while (!result.EndOfMessage);

                var message = Encoding.UTF8.GetString(ms.GetBuffer(), 0, (int)ms.Length);
                HandleIncoming(message);
            }
        }
        catch (OperationCanceledException) { /* normal shutdown */ }
        catch (Exception ex)
        {
            ConnectionClosed?.Invoke(ex);
        }
    }

    private void HandleIncoming(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var type = doc.RootElement.GetProperty("type").GetString();
            switch (type)
            {
                case "message":
                    var msg = JsonSerializer.Deserialize<Message>(raw, JsonCaseInsensitive);
                    if (msg is not null)
                        MainThread.BeginInvokeOnMainThread(() => MessageReceived?.Invoke(msg));
                    break;

                case "stream_start":
                    {
                        var msgId = doc.RootElement.TryGetProperty("message_id", out var mid) ? mid.GetString() ?? "" : "";
                        MainThread.BeginInvokeOnMainThread(() => StreamStarted?.Invoke(msgId));
                    }
                    break;

                case "stream_chunk":
                    {
                        var msgId = doc.RootElement.TryGetProperty("message_id", out var mid) ? mid.GetString() ?? "" : "";
                        var chunk = doc.RootElement.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "";
                        MainThread.BeginInvokeOnMainThread(() => StreamChunkReceived?.Invoke(msgId, chunk));
                    }
                    break;

                case "stream_end":
                    {
                        var msgId = doc.RootElement.TryGetProperty("message_id", out var mid) ? mid.GetString() ?? "" : "";
                        MainThread.BeginInvokeOnMainThread(() => StreamEnded?.Invoke(msgId));
                    }
                    break;

                case "channel_update":
                    MainThread.BeginInvokeOnMainThread(() => ChannelUpdated?.Invoke());
                    break;
            }
        }
        catch
        {
            // Malformed payload — ignore rather than crash the receive loop.
        }
    }

    private static readonly JsonSerializerOptions JsonCaseInsensitive = new() { PropertyNameCaseInsensitive = true };

    public async ValueTask DisposeAsync()
    {
        await DisconnectAsync();
        _cts?.Dispose();
        _cts = null;
        _connectionLock.Dispose();
    }
}
