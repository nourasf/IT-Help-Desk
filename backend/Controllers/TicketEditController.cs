using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/tickets")]
[Authorize(Roles = "Manager,Admin")]
public class TicketEditController : ControllerBase
{
    private readonly AppDbContext _context;
    public TicketEditController(AppDbContext context) => _context = context;

    public sealed class EditTicketRequest
    {
        public string Subject { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
    }

    [HttpPut("{id:int}/workflow-edit")]
    public async Task<IActionResult> Edit(int id, EditTicketRequest request)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { message = "Subject and description are required." });

        var ticket = await _context.Tickets.Include(t => t.Status).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null) return NotFound(new { message = "Ticket not found." });
        if (ticket.Status.StatusName.Equals("Closed", StringComparison.OrdinalIgnoreCase) || ticket.Status.StatusName.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Closed or cancelled tickets are read-only." });

        var categoryName = request.Category.Trim().ToLower();
        var priorityName = request.Priority.Trim().ToLower();
        var category = await _context.Categories.FirstOrDefaultAsync(c => c.IsActive && c.Name.ToLower() == categoryName);
        var priority = await _context.Priorities.FirstOrDefaultAsync(p => p.Name.ToLower() == priorityName);
        if (category == null) return BadRequest(new { message = "Invalid category." });
        if (priority == null) return BadRequest(new { message = "Invalid priority." });

        var oldValue = $"{ticket.Subject} | {ticket.Status.StatusName}";
        ticket.Subject = request.Subject.Trim();
        ticket.Description = request.Description.Trim();
        ticket.CategoryId = category.ID;
        ticket.PriorityId = priority.ID;
        ticket.UpdatedAt = DateTime.UtcNow;
        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = userId,
            Action = "Ticket edited",
            OldValue = oldValue,
            NewValue = $"{ticket.Subject} | {category.Name} | {priority.Name}",
            CreatedAt = ticket.UpdatedAt.Value
        });
        await _context.SaveChangesAsync();
        return Ok(new { message = "Ticket updated successfully." });
    }
}
