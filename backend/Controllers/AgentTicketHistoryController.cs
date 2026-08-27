using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/tickets")]
public class AgentTicketHistoryController : ControllerBase
{
    private readonly AppDbContext _context;
    private static readonly TimeSpan AgentHistoryWindow = TimeSpan.FromDays(7);
    public AgentTicketHistoryController(AppDbContext context) => _context = context;

    [HttpGet("{id:int}/agent-history")]
    [Authorize(Roles = "Agent,IT Support Agent,Admin")]
    public async Task<IActionResult> GetAgentHistory(int id)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var ticket = await _context.Tickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });

        if (!role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
        {
            var assignment = await _context.TicketAssignments.AsNoTracking()
                .Where(a => a.TicketID == id && a.AgentUserID == userId)
                .OrderByDescending(a => a.AssignedAt)
                .FirstOrDefaultAsync();
            if (assignment == null) return Forbid();
            var lastRelevant = assignment.UnassignedAt ?? ticket.ClosedAt ?? ticket.UpdatedAt ?? assignment.AssignedAt;
            if (ticket.AssignedToUserId != userId && DateTime.UtcNow - lastRelevant > AgentHistoryWindow)
                return StatusCode(403, new { message = "History access for this ticket has expired." });
        }

        var history = await _context.TicketHistories.AsNoTracking()
            .Where(h => h.TicketID == id)
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => new
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
