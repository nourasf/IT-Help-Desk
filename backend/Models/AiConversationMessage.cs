namespace backend.Models;

public class AiConversationMessage
{
    public int ID { get; set; }
    public int ConversationID { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AiConversation Conversation { get; set; } = null!;
}
