using System.Text.Json.Serialization;

namespace OctoMaui.Models;

/// <summary>A conversation channel (1:1, group, or agent).</summary>
public sealed class Channel
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Avatar { get; set; }

    /// <summary>direct | group | agent</summary>
    [JsonPropertyName("channel_type")]
    public ChannelType Type { get; set; } = ChannelType.Direct;

    /// <summary>Last read message id (for unread badge calc).</summary>
    [JsonPropertyName("last_read_message_id")]
    public string? LastReadMessageId { get; set; }

    /// <summary>Unread count, filled by client.</summary>
    [JsonIgnore]
    public int UnreadCount { get; set; }

    /// <summary>Preview of the most recent message, filled by client.</summary>
    [JsonIgnore]
    public string LastMessagePreview { get; set; } = string.Empty;

    /// <summary>Timestamp of the most recent message, filled by client.</summary>
    [JsonIgnore]
    public long LastMessageTimestampMs { get; set; }

    public override string ToString() => Name;
}

public enum ChannelType
{
    Direct = 1,
    Group = 2,
    Agent = 3,
}
