namespace backend.Models;

public class TicketHistory
{
     public int ID { get; set; }

    public int TicketID { get; set; }

    public Ticket Ticket { get; set; } = null!;

    public int ChangedByUserID { get; set; }

    public User ChangedByUser { get; set; } = null!;

    public string Action { get; set; } = string.Empty;

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
}