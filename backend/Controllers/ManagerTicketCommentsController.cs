using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/tickets")]
[Authorize(Roles = "Manager")]
public class ManagerTicketCommentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NotificationService _notifications;

    public ManagerTicketCommentsController(AppDbContext context, NotificationService notifications)
    {
        _context = context;
        _notifications = notifications;
    }

    public sealed class CommentRequest
    {
        public string Comment { get; set; } = string.Empty;
        public int? ParentCommentID { get; set; }
    }

    [HttpPost("{id:int}/manager-comment")]
    public async Task<IActionResult> Add(int id, CommentRequest request)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var managerId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        if (request == null || string.IsNullOrWhiteSpace(request.Comment))
            return BadRequest(new { message = "Comment cannot be empty." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });

        if (ticket.Status.StatusName.Equals("Closed", StringComparison.OrdinalIgnoreCase) ||
            ticket.Status.StatusName.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Closed or cancelled tickets are read-only." });
        }

        if (request.ParentCommentID.HasValue)
        {
            var parentExists = await _context.TicketComments.AnyAsync(c =>
                c.ID == request.ParentCommentID.Value && c.TicketID == id && !c.IsInternal);
            if (!parentExists)
                return BadRequest(new { message = "Parent comment was not found on this ticket." });
        }

        var manager = await _context.Users.FirstOrDefaultAsync(u => u.ID == managerId);
        if (manager == null)
            return Unauthorized(new { message = "Manager account was not found." });

        var now = DateTime.UtcNow;
        var comment = new TicketComment
        {
            TicketID = id,
            UserID = managerId,
            Comment = request.Comment.Trim(),
            ParentCommentID = request.ParentCommentID,
            IsInternal = false,
            CreatedAt = now
        };

        _context.TicketComments.Add(comment);
        ticket.UpdatedAt = now;

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = id,
            PerformedByUserID = managerId,
            ActivityType = request.ParentCommentID.HasValue ? "Comment Reply Added" : "Comment Added",
            Description = request.ParentCommentID.HasValue
                ? $"{manager.FullName} added a reply."
                : $"{manager.FullName} added a comment.",
            CreatedAt = now
        });

        var recipients = new List<int> { ticket.CreatedByUserId };
        if (ticket.AssignedToUserId.HasValue)
            recipients.Add(ticket.AssignedToUserId.Value);

        await _notifications.CreateNotificationsAsync(
            recipients.Where(x => x != managerId).Distinct(),
            request.ParentCommentID.HasValue ? "New Ticket Reply" : "New Ticket Comment",
            request.ParentCommentID.HasValue
                ? $"{manager.FullName} replied on {ticket.TicketNumber} - {ticket.Subject}."
                : $"{manager.FullName} commented on {ticket.TicketNumber} - {ticket.Subject}.",
            request.ParentCommentID.HasValue ? "CommentReply" : "CommentAdded",
            ticket.Id);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = request.ParentCommentID.HasValue ? "Reply added successfully." : "Comment added successfully.",
            comment = new
            {
                id = comment.ID,
                comment = comment.Comment,
                createdAt = comment.CreatedAt,
                parentCommentID = comment.ParentCommentID
            }
        });
    }
}
