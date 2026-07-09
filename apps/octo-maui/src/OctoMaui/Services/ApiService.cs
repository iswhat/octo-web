using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using OctoMaui.Models;

namespace OctoMaui.Services;

/// <summary>
/// REST client for octo-server. The internal <see cref="HttpClient"/> can be
/// rebuilt at runtime via <see cref="UpdateBaseUrl"/> when the user switches
/// server domains.
/// </summary>
public sealed class ApiService : IApiService
{
    private readonly ApiOptions _options;
    private HttpClient _http;
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public ApiService(ApiOptions options)
    {
        _options = options;
        _http = CreateClient(options.BaseUrl, options.Timeout);
    }

    public string BaseUrl => _options.BaseUrl;

    /// <inheritdoc />
    public void UpdateBaseUrl(string url)
    {
        var normalized = NormalizeUrl(url);
        _options.BaseUrl = normalized;
        var old = _http;
        _http = CreateClient(normalized, _options.Timeout);
        old.Dispose();
    }

    /// <inheritdoc />
    public async Task<bool> PingAsync(string url, CancellationToken ct = default)
    {
        var normalized = NormalizeUrl(url);
        using var probe = CreateClient(normalized, TimeSpan.FromSeconds(5));
        try
        {
            // Any HTTP response (even 401/404) means the server is reachable.
            using var resp = await probe.GetAsync("/", ct);
            return true;
        }
        catch
        {
            return false;
        }
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

    private static HttpClient CreateClient(string baseUrl, TimeSpan timeout)
    {
        var client = new HttpClient
        {
            BaseAddress = new Uri(baseUrl),
            Timeout = timeout,
        };
        return client;
    }

    /// <summary>
    /// Normalize a user-entered server URL: ensure a scheme is present, trim
    /// trailing slashes, and strip any path component (we only want the origin).
    /// </summary>
    internal static string NormalizeUrl(string url)
    {
        var s = url.Trim();
        if (string.IsNullOrEmpty(s))
            throw new ArgumentException("Server URL cannot be empty.");

        // Add https:// if no scheme present.
        if (!s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            s = "https://" + s;
        }

        // Strip everything after the origin (path / query / fragment).
        // We only store the scheme + host + port.
        if (Uri.TryCreate(s, UriKind.Absolute, out var uri))
        {
            var builder = new UriBuilder(uri.Scheme, uri.Host, uri.Port);
            return builder.ToString().TrimEnd('/');
        }

        throw new ArgumentException($"Invalid server URL: {url}");
    }

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
