
namespace backend.Models;
public class Ticket
{
    public int Id { get; set; }

    public string TicketNumber { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? ResolutionNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime? UpdatedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    public bool IsDeleted { get; set; } = false;

    public int CreatedByUserId { get; set; }

    public int? AssignedToUserId { get; set; }

    public int CategoryId { get; set; }

    public int PriorityId { get; set; }

    public int StatusId { get; set; }

    public User CreatedByUser { get; set; } = null!;

    public User? AssignedToUser { get; set; }

    public Category Category { get; set; } = null!;

    public Priority Priority { get; set; } = null!;

    public DateTime ResolvedAt { get; set; }

    public int ProgressPercentage { get; set; } = 0;

    public Status Status { get; set; } = null!;

    public ICollection<TicketComment> TicketComments {get; set;}= new List<TicketComment>();
     
    public ICollection<TicketHistory> History { get; set; }
    = new List<TicketHistory>();

    public ICollection<TicketAssignment> TicketAssignments { get; set; } = 
    new List<TicketAssignment>();
}