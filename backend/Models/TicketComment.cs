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

    // false = normal comment
    // true = internal note
    public bool IsInternal { get; set; } = false;

    // null = main comment
    // value = reply/sub-comment
    public int? ParentCommentID { get; set; }

    public TicketComment? ParentComment { get; set; }

    public ICollection<TicketComment> Replies { get; set; }
        = new List<TicketComment>();

    public ICollection<FileAttachment> Attachments { get; set; }
        = new List<FileAttachment>();
}