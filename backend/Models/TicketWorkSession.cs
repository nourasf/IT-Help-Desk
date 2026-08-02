namespace backend.Models;

public class TicketWorkSession
{
    public int ID { get; set; }

    public int TicketID { get; set; }

    public int AgentUserID { get; set; }

    public DateTime StartAt { get; set; } = DateTime.UtcNow;

    public DateTime? EndedAt { get; set; }
    
    public int? DurationMinutes { get; set; }

    public string? StopReason { get; set; }

    public Ticket Ticket { get; set; } = null!;

    public User AgentUser { get; set; } = null!;
}