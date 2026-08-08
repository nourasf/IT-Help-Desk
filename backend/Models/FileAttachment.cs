namespace backend.Models;

public class FileAttachment
{
    public int Id { get; set; }

    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public int UploadedByUserId { get; set; }
    public User UploadedByUser { get; set; } = null!;

    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;

    public int? TicketCommentId { get; set; }
    public TicketComment? TicketComment { get; set; }
}
