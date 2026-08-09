using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/tickets/{ticketId:int}/internal-notes")]
[Authorize(Roles = "IT Support Agent,Agent,Manager,Admin")]
public class TicketInternalNotesController : ControllerBase
{
    private readonly AppDbContext _context;

    public TicketInternalNotesController(AppDbContext context)
    {
        _context = context;
    }

    private bool TryGetUserId(out int userId)
        => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    private async Task<bool> CanAccessTicketAsync(int ticketId, int userId)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? "").Trim();
        if (role.Equals("Manager", StringComparison.OrdinalIgnoreCase) || role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            return await _context.Tickets.AnyAsync(t => t.Id == ticketId && !t.IsDeleted);

        return await _context.Tickets.AnyAsync(t => t.Id == ticketId && !t.IsDeleted && t.AssignedToUserId == userId);
    }

    [HttpGet]
    public async Task<IActionResult> GetInternalNotes(int ticketId)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized(new { message = "Invalid user." });

        if (!await CanAccessTicketAsync(ticketId, userId))
            return Forbid();

        var notes = await _context.TicketActivityLogs
            .AsNoTracking()
            .Where(log => log.TicketID == ticketId && log.ActivityType == "Internal Note")
            .OrderBy(log => log.CreatedAt)
            .Select(log => new
            {
                id = log.ID,
                note = log.Description,
                createdAt = log.CreatedAt,
                author = new
                {
                    id = log.PerformedByUser.ID,
                    name = log.PerformedByUser.FullName
                }
            })
            .ToListAsync();

        return Ok(notes);
    }

    public sealed class InternalNoteRequest
    {
        public string Note { get; set; } = string.Empty;
    }

    [HttpPost]
    public async Task<IActionResult> AddInternalNote(int ticketId, InternalNoteRequest request)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized(new { message = "Invalid user." });

        if (!await CanAccessTicketAsync(ticketId, userId))
            return Forbid();

        if (request == null || string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "Internal note cannot be empty." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == ticketId && !t.IsDeleted);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });

        if (ticket.Status.StatusName.Equals("Closed", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Closed tickets are read-only." });

        var now = DateTime.UtcNow;
        var note = new TicketActivityLog
        {
            TicketID = ticketId,
            PerformedByUserID = userId,
            ActivityType = "Internal Note",
            Description = request.Note.Trim(),
            CreatedAt = now
        };

        _context.TicketActivityLogs.Add(note);
        ticket.UpdatedAt = now;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Internal note added.", id = note.ID, createdAt = note.CreatedAt });
    }
}
