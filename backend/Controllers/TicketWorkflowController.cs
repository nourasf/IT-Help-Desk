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
public class TicketWorkflowController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NotificationService _notificationService;

    public TicketWorkflowController(AppDbContext context, NotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    private bool TryGetUserId(out int userId)
        => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    [HttpPost("{id:int}/return-to-manager")]
    [Authorize(Roles = "IT Support Agent,Agent")]
    public async Task<IActionResult> ReturnToManager(int id, TicketActionRequest request)
    {
        if (!TryGetUserId(out var agentUserId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        if (request == null || string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "A reason is required before returning the ticket." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });

        if (ticket.AssignedToUserId != agentUserId)
            return Forbid();

        if (ticket.Status.StatusName.Equals("Closed", StringComparison.OrdinalIgnoreCase) ||
            ticket.Status.StatusName.Equals("Resolved", StringComparison.OrdinalIgnoreCase) ||
            ticket.Status.StatusName.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "This ticket cannot be returned in its current state." });
        }

        var openStatus = await _context.Statuses
            .FirstOrDefaultAsync(s => s.StatusName.ToLower() == "open");

        if (openStatus == null)
            return BadRequest(new { message = "Open status was not found." });

        var now = DateTime.UtcNow;
        var agentName = ticket.AssignedToUser?.FullName ?? "Assigned agent";
        var previousStatus = ticket.Status.StatusName;
        var reason = request.Note.Trim();

        var activeSessions = await _context.TicketWorkSessions
            .Where(s => s.TicketID == ticket.Id && s.AgentUserID == agentUserId && s.EndedAt == null)
            .ToListAsync();

        foreach (var session in activeSessions)
        {
            session.EndedAt = now;
            session.DurationMinutes = Math.Max(1, (int)Math.Ceiling((now - session.StartAt).TotalMinutes));
            session.StopReason = "Returned to manager: " + reason;
        }

        var activeAssignment = await _context.TicketAssignments
            .FirstOrDefaultAsync(a => a.TicketID == ticket.Id && a.UnassignedAt == null);

        if (activeAssignment != null)
        {
            activeAssignment.UnassignedAt = now;
            activeAssignment.UnassignmentReason = "Agent could not resolve: " + reason;
        }

        ticket.AssignedToUserId = null;
        ticket.StatusId = openStatus.ID;
        ticket.UpdatedAt = now;

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = agentUserId,
            Action = "Returned to manager",
            OldValue = $"{previousStatus} / {agentName}",
            NewValue = $"Open / Unassigned - {reason}",
            CreatedAt = now
        });

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = agentUserId,
            ActivityType = "Returned to Manager",
            Description = $"{agentName} could not resolve the issue and returned the ticket for reassignment. Reason: {reason}",
            CreatedAt = now
        });

        var managerIds = await _notificationService.GetUserIdsByRoleAsync("Manager");
        await _notificationService.CreateNotificationsAsync(
            managerIds,
            "Ticket Needs Reassignment",
            $"{ticket.TicketNumber} - {ticket.Subject} was returned by {agentName} and needs another agent.",
            "TicketReturned",
            ticket.Id
        );

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Ticket returned to the manager for reassignment.",
            status = "Open",
            assignedAgent = (object?)null
        });
    }
}
