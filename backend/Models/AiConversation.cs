namespace backend.Models;

public class AiConversation
{
    public int ID { get; set; }
    public int UserID { get; set; }
    public string Title { get; set; } = "New conversation";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public ICollection<AiConversationMessage> Messages { get; set; } = new List<AiConversationMessage>();
}
