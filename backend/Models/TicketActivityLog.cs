namespace backend.Models;

public class TicketActivityLog
{
    public int ID { get; set; }

    public int TicketID { get; set; }

    public int PerformedByUserID { get; set; }

    public string ActivityType { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public int? ProgressPercent { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Ticket Ticket { get; set; } = null!;

    public User PerformedByUser { get; set; } = null!;
}