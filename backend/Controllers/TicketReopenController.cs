using backend.Data;
using backend.DTOs.Tickets;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/tickets")]
public class TicketReopenController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NotificationService _notificationService;

    public TicketReopenController(AppDbContext context, NotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    private bool TryGetUserId(out int userId)
        => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    [HttpPost("{id:int}/manager-reopen")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> ManagerReopen(int id, TicketActionRequest request)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        if (request == null || string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "Reopen reason is required." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });

        var previousStatus = ticket.Status.StatusName;
        if (!previousStatus.Equals("Resolved", StringComparison.OrdinalIgnoreCase) &&
            !previousStatus.Equals("Closed", StringComparison.OrdinalIgnoreCase) &&
            !previousStatus.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only resolved, closed, or cancelled tickets can be reopened." });
        }

        var reopenedStatus = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName.ToLower() == "reopened");
        var openStatus = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName.ToLower() == "open");
        var targetStatus = reopenedStatus ?? openStatus;

        if (targetStatus == null)
            return BadRequest(new { message = "Reopened or Open status was not found." });

        var now = DateTime.UtcNow;
        var previousAgentId = ticket.AssignedToUserId;
        var previousAgentName = ticket.AssignedToUser?.FullName;

        var activeSessions = await _context.TicketWorkSessions
            .Where(s => s.TicketID == ticket.Id && s.EndedAt == null)
            .ToListAsync();

        foreach (var session in activeSessions)
        {
            session.EndedAt = now;
            session.DurationMinutes = Math.Max(1, (int)Math.Ceiling((now - session.StartAt).TotalMinutes));
            session.StopReason = "Ticket reopened for reassignment";
        }

        var activeAssignment = await _context.TicketAssignments
            .FirstOrDefaultAsync(a => a.TicketID == ticket.Id && a.UnassignedAt == null);

        if (activeAssignment != null)
        {
            activeAssignment.UnassignedAt = now;
            activeAssignment.UnassignmentReason = "Ticket reopened for manager reassignment";
        }

        ticket.AssignedToUserId = null;
        ticket.StatusId = targetStatus.ID;
        ticket.ClosedAt = null;
        ticket.ResolvedAt = null;
        ticket.ProgressPercentage = 0;
        ticket.UpdatedAt = now;

        var reason = request.Note.Trim();
        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = userId,
            Action = "Ticket reopened",
            OldValue = previousAgentName == null ? previousStatus : $"{previousStatus} / {previousAgentName}",
            NewValue = $"{targetStatus.StatusName} / Unassigned - {reason}",
            CreatedAt = now
        });

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = userId,
            ActivityType = "Reopened",
            Description = $"Ticket reopened for reassignment. Reason: {reason}",
            ProgressPercent = 0,
            CreatedAt = now
        });

        var recipients = new List<int> { ticket.CreatedByUserId };
        if (previousAgentId.HasValue)
            recipients.Add(previousAgentId.Value);

        await _notificationService.CreateNotificationsAsync(
            recipients.Where(recipientId => recipientId != userId),
            "Ticket Reopened",
            $"{ticket.TicketNumber} - {ticket.Subject} was reopened and is waiting for reassignment.",
            "TicketReopened",
            ticket.Id
        );

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Ticket reopened successfully and returned to the assignment queue.",
            status = targetStatus.StatusName,
            assignedAgent = (object?)null
        });
    }
}
