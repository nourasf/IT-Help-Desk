using backend.Data;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/tickets/{ticketId:int}/attachments")]
[Authorize]
public class AttachmentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AttachmentService _attachmentService;

    public AttachmentsController(AppDbContext context, AttachmentService attachmentService)
    {
        _context = context;
        _attachmentService = attachmentService;
    }

    [HttpPost]
    [RequestSizeLimit(AttachmentService.MaxRequestBytes)]
    public async Task<IActionResult> Upload(
        int ticketId,
        [FromForm] List<IFormFile> files,
        [FromForm] int? ticketCommentId = null)
    {
        if (!TryGetUser(out var userId, out var role))
        {
            return Unauthorized(new { message = "Invalid or missing user information in token." });
        }

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == ticketId && !t.IsDeleted);

        if (ticket == null)
        {
            return NotFound(new { message = "Ticket not found." });
        }

        if (!CanAccessTicket(ticket.CreatedByUserId, ticket.AssignedToUserId, userId, role))
        {
            return Forbid();
        }

        if (ticket.Status.StatusName.Equals("Closed", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Attachments cannot be added to a closed ticket." });
        }

        if (ticketCommentId.HasValue)
        {
            var commentExists = await _context.TicketComments
                .AnyAsync(c => c.ID == ticketCommentId.Value && c.TicketID == ticketId);

            if (!commentExists)
            {
                return BadRequest(new { message = "The selected comment does not belong to this ticket." });
            }
        }

        try
        {
            var attachments = await _attachmentService.SaveAsync(
                ticketId,
                userId,
                files,
                ticketCommentId);

            return Ok(new
            {
                message = attachments.Count == 1
                    ? "Attachment uploaded successfully."
                    : $"{attachments.Count} attachments uploaded successfully.",
                attachments = attachments.Select(a => new
                {
                    id = a.Id,
                    fileName = a.OriginalFileName,
                    contentType = a.ContentType,
                    fileSize = a.FileSize,
                    uploadedAt = a.UploadedAt,
                    ticketCommentId = a.TicketCommentId
                })
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> List(int ticketId)
    {
        if (!TryGetUser(out var userId, out var role))
        {
            return Unauthorized(new { message = "Invalid or missing user information in token." });
        }

        var ticket = await _context.Tickets
            .AsNoTracking()
            .Where(t => t.Id == ticketId && !t.IsDeleted)
            .Select(t => new { t.CreatedByUserId, t.AssignedToUserId })
            .FirstOrDefaultAsync();

        if (ticket == null)
        {
            return NotFound(new { message = "Ticket not found." });
        }

        if (!CanAccessTicket(ticket.CreatedByUserId, ticket.AssignedToUserId, userId, role))
        {
            return Forbid();
        }

        var attachments = await _context.FileAttachments
            .AsNoTracking()
            .Where(a => a.TicketId == ticketId)
            .OrderBy(a => a.UploadedAt)
            .Select(a => new
            {
                id = a.Id,
                fileName = a.OriginalFileName,
                contentType = a.ContentType,
                fileSize = a.FileSize,
                uploadedAt = a.UploadedAt,
                uploadedBy = new
                {
                    id = a.UploadedByUser.ID,
                    name = a.UploadedByUser.FullName
                },
                ticketCommentId = a.TicketCommentId
            })
            .ToListAsync();

        return Ok(attachments);
    }

    [HttpGet("{attachmentId:int}/download")]
    public async Task<IActionResult> Download(int ticketId, int attachmentId)
    {
        if (!TryGetUser(out var userId, out var role))
        {
            return Unauthorized(new { message = "Invalid or missing user information in token." });
        }

        var attachment = await _context.FileAttachments
            .Include(a => a.Ticket)
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.TicketId == ticketId);

        if (attachment == null || attachment.Ticket.IsDeleted)
        {
            return NotFound(new { message = "Attachment not found." });
        }

        if (!CanAccessTicket(
            attachment.Ticket.CreatedByUserId,
            attachment.Ticket.AssignedToUserId,
            userId,
            role))
        {
            return Forbid();
        }

        var path = _attachmentService.GetAbsolutePath(attachment);

        if (!System.IO.File.Exists(path))
        {
            return NotFound(new { message = "The attachment file is missing from storage." });
        }

        return PhysicalFile(
            path,
            attachment.ContentType,
            attachment.OriginalFileName,
            enableRangeProcessing: true);
    }

    private bool TryGetUser(out int userId, out string role)
    {
        role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        return int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
    }

    private static bool CanAccessTicket(
        int employeeId,
        int? assignedAgentId,
        int userId,
        string role)
    {
        if (role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("Manager", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (role.Equals("Employee", StringComparison.OrdinalIgnoreCase))
        {
            return employeeId == userId;
        }

        if (role.Equals("IT Support Agent", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("Agent", StringComparison.OrdinalIgnoreCase))
        {
            return assignedAgentId == userId;
        }

        return false;
    }
}
