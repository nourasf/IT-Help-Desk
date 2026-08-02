namespace backend.Models;

public class TicketAssignment
{
    public int ID { get; set; }

    public int TicketID { get; set; }

    public int AgentUserID { get; set; }

    public int AssignedByUserID { get; set; }

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UnassignedAt { get; set; }

    public string? UnassignmentReason { get; set; }

    public Ticket Ticket { get; set; } = null!;

    public User AgentUser { get; set; } = null!;

    public User AssignedByUser { get; set; } = null!;
}