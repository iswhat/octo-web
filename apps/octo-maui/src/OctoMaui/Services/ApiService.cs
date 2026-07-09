using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using OctoMaui.Models;

namespace OctoMaui.Services;

/// <summary>
/// REST client for octo-server. Uses a shared <see cref="HttpClient"/>.
/// </summary>
public sealed class ApiService : IApiService
{
    private readonly HttpClient _http;
    private readonly ApiOptions _options;
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public ApiService(ApiOptions options)
    {
        _options = options;
        _http = new HttpClient { BaseAddress = new Uri(options.BaseUrl), Timeout = options.Timeout };
    }

    public async Task<LoginResult> LoginAsync(string username, string password, CancellationToken ct = default)
    {
        var payload = new { username, password };
        var resp = await _http.PostAsJsonAsync("/user/login", payload, ct);
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<LoginResult>(Json, ct)
                   ?? throw new InvalidOperationException("Empty login response.");
        return body;
    }

    public async Task<User> GetCurrentUserAsync(string token, CancellationToken ct = default)
    {
        using var req = Authed(token, HttpMethod.Get, "/user/current");
        return await SendAsync<User>(req, ct);
    }

    public async Task<List<Channel>> GetChannelsAsync(string token, CancellationToken ct = default)
    {
        using var req = Authed(token, HttpMethod.Get, "/channel/list");
        return await SendAsync<List<Channel>>(req, ct);
    }

    public async Task<List<Message>> GetMessagesAsync(string token, string channelId, int limit = 50, long? beforeTimestamp = null, CancellationToken ct = default)
    {
        var path = $"/channel/{channelId}/messages?limit={limit}";
        if (beforeTimestamp is { } ts) path += $"&before={ts}";
        using var req = Authed(token, HttpMethod.Get, path);
        return await SendAsync<List<Message>>(req, ct);
    }

    public async Task<Message> SendMessageAsync(string token, string channelId, string content, CancellationToken ct = default)
    {
        var payload = new { channel_id = channelId, content, message_type = 1 };
        using var req = Authed(token, HttpMethod.Post, $"/channel/{channelId}/message/send");
        req.Content = JsonContent.Create(payload);
        return await SendAsync<Message>(req, ct);
    }

    // --- helpers ---

    private HttpRequestMessage Authed(string token, HttpMethod method, string path)
    {
        var req = new HttpRequestMessage(method, path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return req;
    }

    private async Task<T> SendAsync<T>(HttpRequestMessage req, CancellationToken ct)
    {
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<T>(Json, ct)
               ?? throw new InvalidOperationException($"Empty response from {req.RequestUri}.");
    }
}

/// <summary>Login response from octo-server.</summary>
public sealed class LoginResult
{
    public string Token { get; set; } = string.Empty;
    public User User { get; set; } = new();
}
