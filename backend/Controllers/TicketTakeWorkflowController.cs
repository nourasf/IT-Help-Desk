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
public class TicketTakeWorkflowController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NotificationService _notifications;

    public TicketTakeWorkflowController(AppDbContext context, NotificationService notifications)
    {
        _context = context;
        _notifications = notifications;
    }

    [HttpPost("{id:int}/workflow-take")]
    [Authorize(Roles = "Agent,IT Support Agent")]
    public async Task<IActionResult> Take(int id)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var agentId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });

        if (ticket.AssignedToUserId != null)
            return Conflict(new { message = "Ticket is already assigned." });

        var currentStatus = ticket.Status.StatusName;
        if (!currentStatus.Equals("Open", StringComparison.OrdinalIgnoreCase) &&
            !currentStatus.Equals("New", StringComparison.OrdinalIgnoreCase) &&
            !currentStatus.Equals("Reopened", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only new, open, or reopened tickets can be taken." });
        }

        var agent = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.ID == agentId);

        if (agent?.Role == null ||
            !(agent.Role.Name.Equals("Agent", StringComparison.OrdinalIgnoreCase) ||
              agent.Role.Name.Equals("IT Support Agent", StringComparison.OrdinalIgnoreCase)))
        {
            return Forbid();
        }

        var assigned = await _context.Statuses
            .FirstOrDefaultAsync(s => s.StatusName.ToLower() == "assigned");

        if (assigned == null)
            return BadRequest(new { message = "The Assigned status is missing from the database." });

        var now = DateTime.UtcNow;
        ticket.AssignedToUserId = agentId;
        ticket.StatusId = assigned.ID;
        ticket.UpdatedAt = now;

        _context.TicketAssignments.Add(new TicketAssignment
        {
            TicketID = ticket.Id,
            AgentUserID = agentId,
            AssignedByUserID = agentId,
            AssignedAt = now
        });

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = agentId,
            Action = "Ticket taken",
            OldValue = $"{currentStatus} / Unassigned",
            NewValue = $"Assigned / {agent.FullName}",
            CreatedAt = now
        });

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = agentId,
            ActivityType = "Taken",
            Description = $"{agent.FullName} took the ticket and became the assigned agent.",
            CreatedAt = now
        });

        await _notifications.CreateNotificationAsync(
            ticket.CreatedByUserId,
            "Ticket Assigned",
            $"{ticket.TicketNumber} has been taken by {agent.FullName}.",
            "TicketAssigned",
            ticket.Id);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Ticket taken successfully.",
            status = "Assigned",
            assignedAgent = new { id = agent.ID, name = agent.FullName }
        });
    }
}
