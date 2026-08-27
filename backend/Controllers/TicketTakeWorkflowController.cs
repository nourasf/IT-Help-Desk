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

    private bool TryUserId(out int id) => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out id);

    [HttpPost("{id:int}/workflow-take")]
    [Authorize(Roles = "Agent,IT Support Agent")]
    public async Task<IActionResult> RequestTake(int id)
    {
        if (!TryUserId(out var agentId)) return Unauthorized();
        var ticket = await _context.Tickets.Include(t => t.Status).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        if (ticket.AssignedToUserId != null) return Conflict(new { message = "Ticket is already assigned." });
        var status = ticket.Status.StatusName;
        if (!new[] { "Open", "New", "Reopened" }.Any(x => x.Equals(status, StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { message = "Only new, open, or reopened tickets can be requested." });

        var agent = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.ID == agentId);
        if (agent?.Role == null || !(agent.Role.Name.Equals("Agent", StringComparison.OrdinalIgnoreCase) || agent.Role.Name.Equals("IT Support Agent", StringComparison.OrdinalIgnoreCase))) return Forbid();

        var alreadyPending = await _context.TicketActivityLogs.AnyAsync(a => a.TicketID == id && a.PerformedByUserID == agentId && a.ActivityType == "TakeRequested" &&
            !_context.TicketActivityLogs.Any(b => b.TicketID == id && b.CreatedAt > a.CreatedAt && (b.ActivityType == "TakeApproved" || b.ActivityType == "TakeRejected" || b.ActivityType == "Assigned" || b.ActivityType == "Reassigned")));
        if (alreadyPending) return Conflict(new { message = "Your request is already waiting for manager approval." });

        var now = DateTime.UtcNow;
        _context.TicketActivityLogs.Add(new TicketActivityLog { TicketID = id, PerformedByUserID = agentId, ActivityType = "TakeRequested", Description = $"{agent.FullName} requested approval to take this ticket.", CreatedAt = now });
        var managers = await _notifications.GetUserIdsByRoleAsync("Manager", "Admin");
        await _notifications.CreateNotificationsAsync(managers, "Agent Take Request", $"{agent.FullName} requested approval to take {ticket.TicketNumber} - {ticket.Subject}.", "TakeRequested", ticket.Id);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Request sent to the manager for approval.", status = "Pending Approval" });
    }

    [HttpGet("{id:int}/take-request")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> GetPendingRequest(int id)
    {
        var latest = await _context.TicketActivityLogs.AsNoTracking()
            .Where(a => a.TicketID == id && a.ActivityType == "TakeRequested")
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new { a.ID, a.PerformedByUserID, a.CreatedAt, agentName = a.PerformedByUser.FullName })
            .FirstOrDefaultAsync();
        if (latest == null) return Ok(new { pending = false });
        var completed = await _context.TicketActivityLogs.AnyAsync(a => a.TicketID == id && a.CreatedAt > latest.CreatedAt && (a.ActivityType == "TakeApproved" || a.ActivityType == "TakeRejected" || a.ActivityType == "Assigned" || a.ActivityType == "Reassigned"));
        return Ok(completed ? new { pending = false } : new { pending = true, requestId = latest.ID, agentId = latest.PerformedByUserID, agentName = latest.agentName, requestedAt = latest.CreatedAt });
    }

    public sealed class TakeDecisionRequest { public int AgentUserId { get; set; } public string? Reason { get; set; } }

    [HttpPost("{id:int}/take-request/approve")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Approve(int id, TakeDecisionRequest request)
    {
        if (!TryUserId(out var managerId)) return Unauthorized();
        var ticket = await _context.Tickets.Include(t => t.Status).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        if (ticket.AssignedToUserId != null) return Conflict(new { message = "Ticket is already assigned." });
        var agent = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.ID == request.AgentUserId);
        if (agent?.Role == null || !(agent.Role.Name.Equals("Agent", StringComparison.OrdinalIgnoreCase) || agent.Role.Name.Equals("IT Support Agent", StringComparison.OrdinalIgnoreCase))) return BadRequest(new { message = "Invalid agent." });
        var requested = await _context.TicketActivityLogs.AnyAsync(a => a.TicketID == id && a.PerformedByUserID == agent.ID && a.ActivityType == "TakeRequested");
        if (!requested) return BadRequest(new { message = "No take request from this agent was found." });
        var assigned = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName.ToLower() == "assigned");
        if (assigned == null) return BadRequest(new { message = "Assigned status is missing." });

        var now = DateTime.UtcNow;
        var oldStatus = ticket.Status.StatusName;
        ticket.AssignedToUserId = agent.ID; ticket.StatusId = assigned.ID; ticket.UpdatedAt = now;
        _context.TicketAssignments.Add(new TicketAssignment { TicketID = id, AgentUserID = agent.ID, AssignedByUserID = managerId, AssignedAt = now });
        _context.TicketHistories.Add(new TicketHistory { TicketID = id, ChangedByUserID = managerId, Action = "Take request approved", OldValue = $"{oldStatus} / Unassigned", NewValue = $"Assigned / {agent.FullName}", CreatedAt = now });
        _context.TicketActivityLogs.Add(new TicketActivityLog { TicketID = id, PerformedByUserID = managerId, ActivityType = "TakeApproved", Description = $"Manager approved {agent.FullName}'s request to take the ticket.", CreatedAt = now });
        await _notifications.CreateNotificationAsync(agent.ID, "Take Request Approved", $"Your request to take {ticket.TicketNumber} was approved.", "TakeApproved", ticket.Id);
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Approved. Ticket assigned to {agent.FullName}.", status = "Assigned" });
    }

    [HttpPost("{id:int}/take-request/reject")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Reject(int id, TakeDecisionRequest request)
    {
        if (!TryUserId(out var managerId)) return Unauthorized();
        var ticket = await _context.Tickets.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        var agent = await _context.Users.FirstOrDefaultAsync(u => u.ID == request.AgentUserId);
        if (agent == null) return BadRequest(new { message = "Invalid agent." });
        var now = DateTime.UtcNow;
        _context.TicketActivityLogs.Add(new TicketActivityLog { TicketID = id, PerformedByUserID = managerId, ActivityType = "TakeRejected", Description = $"Manager rejected {agent.FullName}'s request to take the ticket. {request.Reason}".Trim(), CreatedAt = now });
        await _notifications.CreateNotificationAsync(agent.ID, "Take Request Rejected", $"Your request to take {ticket.TicketNumber} was rejected.", "TakeRejected", ticket.Id);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Take request rejected." });
    }
}
