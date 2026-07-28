namespace backend.Models;

public class TicketComment
{
    public int ID { get; set; }

    public string Comment { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public int TicketID { get; set; }

    public Ticket Ticket { get; set; } = null!;

    public int UserID { get; set; }

    public User User { get; set; } = null!;
}
