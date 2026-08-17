namespace backend.DTOs.Ai;

public class AiChatRequest
{
    public string Message { get; set; } = string.Empty;
    public List<AiChatHistoryMessage> History { get; set; } = new();
}

public class AiChatHistoryMessage
{
    public string Role { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}
