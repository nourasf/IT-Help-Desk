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
public class TicketWorkflowController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NotificationService _notifications;

    public TicketWorkflowController(AppDbContext context, NotificationService notifications)
    {
        _context = context;
        _notifications = notifications;
    }

    private bool TryUserId(out int id) => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out id);

    private async Task<Status?> StatusAsync(params string[] names)
    {
        var lowered = names.Select(x => x.ToLower()).ToList();
        return await _context.Statuses.FirstOrDefaultAsync(s => lowered.Contains(s.StatusName.ToLower()));
    }

    private async Task EndWorkAsync(int ticketId, DateTime now, string reason)
    {
        var sessions = await _context.TicketWorkSessions.Where(s => s.TicketID == ticketId && s.EndedAt == null).ToListAsync();
        foreach (var session in sessions)
        {
            session.EndedAt = now;
            session.DurationMinutes = Math.Max(1, (int)Math.Ceiling((now - session.StartAt).TotalMinutes));
            session.StopReason = reason;
        }
    }

    private async Task EndAssignmentAsync(int ticketId, DateTime now, string reason)
    {
        var assignment = await _context.TicketAssignments.FirstOrDefaultAsync(a => a.TicketID == ticketId && a.UnassignedAt == null);
        if (assignment == null) return;
        assignment.UnassignedAt = now;
        assignment.UnassignmentReason = reason;
    }

    private void History(Ticket ticket, int userId, string action, string? oldValue, string? newValue, DateTime now)
    {
        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = userId,
            Action = action,
            OldValue = oldValue,
            NewValue = newValue,
            CreatedAt = now
        });
    }

    private void Activity(Ticket ticket, int userId, string type, string description, DateTime now, int? progress = null)
    {
        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = userId,
            ActivityType = type,
            Description = description,
            ProgressPercent = progress,
            CreatedAt = now
        });
    }

    public sealed class NoteRequest { public string Note { get; set; } = string.Empty; }
    public sealed class AssignRequest { public int AgentUserId { get; set; } }

    [HttpPost("{id:int}/workflow-assign")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Assign(int id, AssignRequest request)
    {
        if (!TryUserId(out var managerId)) return Unauthorized();
        var ticket = await _context.Tickets.Include(t => t.Status).Include(t => t.AssignedToUser).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        if (ticket.Status.StatusName.Equals("Closed", StringComparison.OrdinalIgnoreCase) || ticket.Status.StatusName.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Closed or cancelled tickets cannot be assigned." });

        var agent = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.ID == request.AgentUserId);
        if (agent == null || agent.Role == null || !(agent.Role.Name.Equals("Agent", StringComparison.OrdinalIgnoreCase) || agent.Role.Name.Equals("IT Support Agent", StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { message = "A valid IT agent is required." });

        var assigned = await StatusAsync("Assigned");
        if (assigned == null) return BadRequest(new { message = "The Assigned status is missing from the database." });

        var now = DateTime.UtcNow;
        var oldAgent = ticket.AssignedToUser?.FullName;
        var oldStatus = ticket.Status.StatusName;
        await EndWorkAsync(ticket.Id, now, "Ticket reassigned");
        await EndAssignmentAsync(ticket.Id, now, oldAgent == null ? "Assigned" : $"Reassigned to {agent.FullName}");

        ticket.AssignedToUserId = agent.ID;
        ticket.StatusId = assigned.ID;
        ticket.UpdatedAt = now;
        _context.TicketAssignments.Add(new TicketAssignment { TicketID = ticket.Id, AgentUserID = agent.ID, AssignedByUserID = managerId, AssignedAt = now });
        History(ticket, managerId, oldAgent == null ? "Ticket assigned" : "Ticket reassigned", $"{oldStatus} / {oldAgent ?? "Unassigned"}", $"Assigned / {agent.FullName}", now);
        Activity(ticket, managerId, oldAgent == null ? "Assigned" : "Reassigned", oldAgent == null ? $"Ticket assigned to {agent.FullName}." : $"Ticket reassigned from {oldAgent} to {agent.FullName}.", now);
        await _notifications.CreateNotificationAsync(agent.ID, "Ticket Assigned", $"{ticket.TicketNumber} - {ticket.Subject} has been assigned to you.", "TicketAssigned", ticket.Id);
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Ticket assigned to {agent.FullName}.", status = "Assigned", assignedAgent = new { id = agent.ID, name = agent.FullName } });
    }

    [HttpPost("{id:int}/workflow-cancel")]
    [Authorize(Roles = "Agent,IT Support Agent")]
    public async Task<IActionResult> Cancel(int id, NoteRequest request)
    {
        if (!TryUserId(out var agentId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request?.Note)) return BadRequest(new { message = "A reason is required." });
        var ticket = await _context.Tickets.Include(t => t.Status).Include(t => t.AssignedToUser).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        if (ticket.AssignedToUserId != agentId) return Forbid();
        if (ticket.Status.StatusName.Equals("Closed", StringComparison.OrdinalIgnoreCase) || ticket.Status.StatusName.Equals("Resolved", StringComparison.OrdinalIgnoreCase) || ticket.Status.StatusName.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "This ticket cannot be cancelled in its current state." });

        var cancelled = await StatusAsync("Cancelled", "Canceled");
        if (cancelled == null) return BadRequest(new { message = "The Cancelled status is missing from the database." });
        var now = DateTime.UtcNow;
        var oldStatus = ticket.Status.StatusName;
        var reason = request.Note.Trim();
        await EndWorkAsync(ticket.Id, now, "No issue found: " + reason);
        await EndAssignmentAsync(ticket.Id, now, "Ticket cancelled: " + reason);
        ticket.StatusId = cancelled.ID;
        ticket.UpdatedAt = now;
        ticket.ClosedAt = now;
        History(ticket, agentId, "Ticket cancelled", oldStatus, $"Cancelled - {reason}", now);
        Activity(ticket, agentId, "Cancelled", $"No issue found. Reason: {reason}", now);
        var managers = await _notifications.GetUserIdsByRoleAsync("Manager", "Admin");
        await _notifications.CreateNotificationsAsync(managers.Append(ticket.CreatedByUserId).Where(x => x != agentId).Distinct(), "Ticket Cancelled", $"{ticket.TicketNumber} was cancelled: no issue found.", "TicketCancelled", ticket.Id);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Ticket cancelled because no issue was found.", status = "Cancelled", closedAt = ticket.ClosedAt });
    }

    [HttpPost("{id:int}/workflow-return")]
    [Authorize(Roles = "Agent,IT Support Agent")]
    public async Task<IActionResult> ReturnToManager(int id, NoteRequest request)
    {
        if (!TryUserId(out var agentId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request?.Note)) return BadRequest(new { message = "Explain why the ticket could not be solved." });
        var ticket = await _context.Tickets.Include(t => t.Status).Include(t => t.AssignedToUser).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        if (ticket.AssignedToUserId != agentId) return Forbid();
        var open = await StatusAsync("New", "Open");
        if (open == null) return BadRequest(new { message = "The New/Open status is missing from the database." });
        var now = DateTime.UtcNow;
        var oldStatus = ticket.Status.StatusName;
        var agentName = ticket.AssignedToUser?.FullName ?? "Agent";
        var reason = request.Note.Trim();
        await EndWorkAsync(ticket.Id, now, "Could not solve: " + reason);
        await EndAssignmentAsync(ticket.Id, now, "Returned to manager: " + reason);
        ticket.AssignedToUserId = null;
        ticket.StatusId = open.ID;
        ticket.UpdatedAt = now;
        History(ticket, agentId, "Returned to manager", $"{oldStatus} / {agentName}", $"{open.StatusName} / Unassigned - {reason}", now);
        Activity(ticket, agentId, "Returned to Manager", $"{agentName} could not solve the ticket. Reason: {reason}", now);
        var managers = await _notifications.GetUserIdsByRoleAsync("Manager", "Admin");
        await _notifications.CreateNotificationsAsync(managers, "Ticket Needs Reassignment", $"{ticket.TicketNumber} was returned by {agentName}. Reason: {reason}", "TicketReturned", ticket.Id);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Ticket returned to the manager for reassignment.", status = open.StatusName, assignedAgent = (object?)null });
    }

    [HttpPost("{id:int}/workflow-close")]
    [Authorize(Roles = "Agent,IT Support Agent")]
    public async Task<IActionResult> Close(int id, NoteRequest request)
    {
        if (!TryUserId(out var agentId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request?.Note)) return BadRequest(new { message = "A closing note is required." });
        var ticket = await _context.Tickets.Include(t => t.Status).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        if (ticket.AssignedToUserId != agentId) return Forbid();
        if (!ticket.Status.StatusName.Equals("Resolved", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Only resolved tickets can be closed." });
        var closed = await StatusAsync("Closed");
        if (closed == null) return BadRequest(new { message = "The Closed status is missing from the database." });
        var now = DateTime.UtcNow;
        var note = request.Note.Trim();
        await EndWorkAsync(ticket.Id, now, "Ticket closed");
        await EndAssignmentAsync(ticket.Id, now, "Ticket closed");
        ticket.StatusId = closed.ID;
        ticket.ClosedAt = now;
        ticket.ProgressPercentage = 100;
        ticket.UpdatedAt = now;
        History(ticket, agentId, "Ticket closed", "Resolved", $"Closed - {note}", now);
        Activity(ticket, agentId, "Closed", $"Ticket closed. Note: {note}", now, 100);
        var recipients = (await _notifications.GetUserIdsByRoleAsync("Manager", "Admin")).Append(ticket.CreatedByUserId).Where(x => x != agentId).Distinct();
        await _notifications.CreateNotificationsAsync(recipients, "Ticket Closed", $"{ticket.TicketNumber} has been closed by the assigned agent.", "TicketClosed", ticket.Id);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Ticket closed successfully.", status = "Closed", closedAt = ticket.ClosedAt });
    }

    [HttpGet("{id:int}/manager-history")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> ManagerHistory(int id)
    {
        var exists = await _context.Tickets.AnyAsync(t => t.Id == id && !t.IsDeleted);
        if (!exists) return NotFound(new { message = "Ticket not found." });
        var history = await _context.TicketHistories.AsNoTracking().Where(h => h.TicketID == id).OrderByDescending(h => h.CreatedAt).Select(h => new
        {
            id = h.ID,
            action = h.Action,
            oldValue = h.OldValue,
            newValue = h.NewValue,
            createdAt = h.CreatedAt,
            changedBy = new { id = h.ChangedByUser.ID, name = h.ChangedByUser.FullName, role = h.ChangedByUser.Role != null ? h.ChangedByUser.Role.Name : "User" }
        }).ToListAsync();
        return Ok(history);
    }
}
