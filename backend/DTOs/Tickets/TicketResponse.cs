namespace backend.DTOs.Tickets;


public class TicketResponse
{
    public int Id { get; set; }

public String TicketNumber { get; set; } = string.Empty;
    public String Subject { get; set; } = string.Empty;
    public String Description { get; set; } = string.Empty;
    public String Status { get; set; } = string.Empty;
    public String Category { get; set; } = string.Empty;
    public String Priority { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } 
    
}