using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/tickets")]
public class TicketDeletePolicyController : ControllerBase
{
    private readonly AppDbContext _context;
    public TicketDeletePolicyController(AppDbContext context) => _context = context;

    [HttpDelete("{id:int}/withdraw")]
    [Authorize(Roles = "Employee,Admin")]
    public async Task<IActionResult> Withdraw(int id)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var ticket = await _context.Tickets.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        if (!role.Equals("Admin", StringComparison.OrdinalIgnoreCase) && ticket.CreatedByUserId != userId) return Forbid();

        var now = DateTime.UtcNow;
        ticket.IsDeleted = true;
        ticket.UpdatedAt = now;
        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = userId,
            Action = role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ? "Ticket deleted by admin" : "Ticket withdrawn by employee",
            OldValue = "Active",
            NewValue = "Deleted",
            CreatedAt = now
        });
        await _context.SaveChangesAsync();
        return Ok(new { message = role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ? "Ticket deleted." : "Ticket withdrawn." });
    }
}
