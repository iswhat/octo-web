using System.Text.Json.Serialization;

namespace OctoMaui.Models;

/// <summary>A user / agent identity in the OCTO platform.</summary>
public sealed class User
{
    /// <summary>Server user id. The octo-server login response uses the
    /// flat field name "uid" (not "id"), so we map it explicitly.</summary>
    [JsonPropertyName("uid")]
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Avatar { get; set; }

    /// <summary>Display name with optional agent badge.</summary>
    public string DisplayName => string.IsNullOrWhiteSpace(Name) ? Id : Name;

    /// <summary>True if this user is an AI agent (Lobster).</summary>
    [JsonPropertyName("is_agent")]
    public bool IsAgent { get; set; }

    public override string ToString() => DisplayName;
}
