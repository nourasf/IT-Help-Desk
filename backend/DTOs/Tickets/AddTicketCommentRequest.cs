public class AddTicketCommentRequest
{
    public string Comment { get; set; } = string.Empty;

    public int? ParentCommentID { get; set; }
}