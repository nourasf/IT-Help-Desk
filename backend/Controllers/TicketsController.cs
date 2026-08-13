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
[Route("api/[controller]")]
public class TicketsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NotificationService _notificationService;

    public TicketsController(AppDbContext context, NotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    private bool TryGetCurrentUserId(out int userId)
        => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    private string CurrentRole()
        => (User.FindFirstValue(ClaimTypes.Role) ?? string.Empty).Trim();

    private static bool IsAgentRole(string role)
        => role.Equals("IT Support Agent", StringComparison.OrdinalIgnoreCase) ||
           role.Equals("Agent", StringComparison.OrdinalIgnoreCase) ||
           role.Equals("IT", StringComparison.OrdinalIgnoreCase);

    private static bool IsStatus(Ticket ticket, string statusName)
        => ticket.Status.StatusName.Equals(statusName, StringComparison.OrdinalIgnoreCase);

    private async Task EndActiveWorkSessionsAsync(int ticketId, DateTime now, string reason)
    {
        var sessions = await _context.TicketWorkSessions
            .Where(session => session.TicketID == ticketId && session.EndedAt == null)
            .ToListAsync();

        foreach (var session in sessions)
        {
            session.EndedAt = now;
            session.DurationMinutes = Math.Max(1, (int)Math.Ceiling((now - session.StartAt).TotalMinutes));
            session.StopReason = reason;
        }
    }

    private async Task EndCurrentAssignmentAsync(int ticketId, DateTime now, string reason)
    {
        var assignment = await _context.TicketAssignments
            .FirstOrDefaultAsync(item => item.TicketID == ticketId && item.UnassignedAt == null);

        if (assignment != null)
        {
            assignment.UnassignedAt = now;
            assignment.UnassignmentReason = reason;
        }
    }

    private async Task<List<int>> GetManagersAndAdminsAsync()
        => await _notificationService.GetUserIdsByRoleAsync("Manager", "Admin");

    private async Task<bool> CanAccessTicketAsync(int ticketId, int userId, bool allowEmployee = true)
    {
        var role = CurrentRole();

        if (role.Equals("Manager", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
        {
            return await _context.Tickets.AnyAsync(t => t.Id == ticketId && !t.IsDeleted);
        }

        if (IsAgentRole(role))
        {
            return await _context.Tickets.AnyAsync(t =>
                t.Id == ticketId && !t.IsDeleted && t.AssignedToUserId == userId);
        }

        if (allowEmployee && role.Equals("Employee", StringComparison.OrdinalIgnoreCase))
        {
            return await _context.Tickets.AnyAsync(t =>
                t.Id == ticketId && !t.IsDeleted && t.CreatedByUserId == userId);
        }

        return false;
    }

    public sealed class InternalNoteRequest
    {
        public string Note { get; set; } = string.Empty;
    }

    [HttpGet("form-options")]
    [Authorize(Roles = "Employee")]
    public async Task<IActionResult> GetTicketFormOptions()
    {
        var categories = await _context.Categories
            .AsNoTracking()
            .Where(category => category.IsActive)
            .OrderBy(category => category.Name)
            .Select(category => new
            {
                category.ID,
                category.Name,
                category.Description
            })
            .ToListAsync();

        var priorities = await _context.Priorities
            .AsNoTracking()
            .OrderBy(priority => priority.ID)
            .Select(priority => new
            {
                priority.ID,
                priority.Name,
                priority.Level,
                Color = priority.color
            })
            .ToListAsync();

        return Ok(new { categories, priorities });
    }

    [HttpPost("create-ticket")]
    [Authorize(Roles = "Employee")]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest request)
    {
        if (request == null)
            return BadRequest(new { message = "Ticket information is required." });
        if (string.IsNullOrWhiteSpace(request.Subject))
            return BadRequest(new { message = "Subject is required." });
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { message = "Description is required." });
        if (string.IsNullOrWhiteSpace(request.Category))
            return BadRequest(new { message = "Category is required." });
        if (string.IsNullOrWhiteSpace(request.Priority))
            return BadRequest(new { message = "Priority is required." });
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var categoryName = request.Category.Trim();
        var priorityName = request.Priority.Trim();

        var category = await _context.Categories.FirstOrDefaultAsync(c =>
            c.IsActive && c.Name.ToLower() == categoryName.ToLower());
        if (category == null)
            return BadRequest(new { message = "Invalid ticket category." });

        var priority = await _context.Priorities.FirstOrDefaultAsync(p =>
            p.Name.ToLower() == priorityName.ToLower());
        if (priority == null)
            return BadRequest(new { message = "Invalid ticket priority." });

        var openStatus = await _context.Statuses.FirstOrDefaultAsync(s =>
            s.StatusName.ToLower() == "open");
        if (openStatus == null)
            return BadRequest(new { message = "The Open ticket status was not found." });

        var employee = await _context.Users.FirstOrDefaultAsync(u => u.ID == userId);
        if (employee == null)
            return Unauthorized(new { message = "The authenticated user was not found." });

        var now = DateTime.UtcNow;
        var ticket = new Ticket
        {
            TicketNumber = $"TKT-{Guid.NewGuid().ToString("N")[..8].ToUpper()}",
            Subject = request.Subject.Trim(),
            Description = request.Description.Trim(),
            CategoryId = category.ID,
            PriorityId = priority.ID,
            StatusId = openStatus.ID,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId,
            IsDeleted = false
        };

        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var managerAndAdminIds = await GetManagersAndAdminsAsync();
        await _notificationService.CreateNotificationsAsync(
            managerAndAdminIds,
            "New Ticket Created",
            $"{ticket.TicketNumber} - {ticket.Subject} was created by {employee.FullName} and needs review.",
            "TicketCreated",
            ticket.Id
        );

        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTicketById), new { id = ticket.Id }, new
        {
            message = "Ticket created successfully.",
            ticketId = ticket.Id,
            ticketNumber = ticket.TicketNumber
        });
    }

    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<IActionResult> GetTicketById(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var role = CurrentRole();
        var query = _context.Tickets.AsNoTracking().Where(t => t.Id == id && !t.IsDeleted);

        if (role.Equals("Employee", StringComparison.OrdinalIgnoreCase))
            query = query.Where(t => t.CreatedByUserId == userId);
        else if (IsAgentRole(role))
            query = query.Where(t => t.AssignedToUserId == userId);
        else if (!role.Equals("Manager", StringComparison.OrdinalIgnoreCase) &&
                 !role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        var ticket = await query.Select(t => new
        {
            id = t.Id,
            ticketNumber = t.TicketNumber,
            subject = t.Subject,
            description = t.Description,
            resolutionNotes = t.ResolutionNotes,
            category = t.Category.Name,
            priority = t.Priority.Name,
            status = t.Status.StatusName,
            progressPercentage = t.ProgressPercentage,
            createdAt = t.CreatedAt,
            updatedAt = t.UpdatedAt,
            resolvedAt = t.ResolvedAt,
            closedAt = t.ClosedAt,
            employee = new
            {
                id = t.CreatedByUser.ID,
                name = t.CreatedByUser.FullName,
                email = t.CreatedByUser.Email
            },
            assignedAgent = t.AssignedToUserId == null ? null : new
            {
                id = t.AssignedToUser!.ID,
                name = t.AssignedToUser.FullName,
                email = t.AssignedToUser.Email
            },
            activeWorkSession = _context.TicketWorkSessions
                .Where(session =>
                    session.TicketID == t.Id &&
                    session.AgentUserID == userId &&
                    session.EndedAt == null)
                .Select(session => new { id = session.ID, startedAt = session.StartAt })
                .FirstOrDefault(),
            totalWorkMinutes = _context.TicketWorkSessions
                .Where(session => session.TicketID == t.Id && session.EndedAt != null)
                .Sum(session => session.DurationMinutes ?? 0),
            isClosed = t.Status.StatusName.ToLower() == "closed",
            canEdit = t.Status.StatusName.ToLower() != "closed"
        }).FirstOrDefaultAsync();

        if (ticket == null)
            return NotFound(new { message = "Ticket not found or you do not have access." });

        return Ok(ticket);
    }

    [HttpGet]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> GetTickets()
    {
        var tickets = await _context.Tickets
            .AsNoTracking()
            .Where(t => !t.IsDeleted)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TicketResponse
            {
                Id = t.Id,
                TicketNumber = t.TicketNumber,
                Subject = t.Subject,
                Description = t.Description,
                Category = t.Category.Name,
                Priority = t.Priority.Name,
                Status = t.Status.StatusName,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        return Ok(tickets);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> UpdateTicket(int id, UpdateTicketRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });
        if (IsStatus(ticket, "Closed"))
            return BadRequest(new { message = "Closed tickets are read-only." });
        if (!await _context.Categories.AnyAsync(c => c.ID == request.CategoryId))
            return BadRequest(new { message = "Invalid category." });
        if (!await _context.Priorities.AnyAsync(p => p.ID == request.PriorityId))
            return BadRequest(new { message = "Invalid priority." });
        if (!await _context.Statuses.AnyAsync(s => s.ID == request.StatusId))
            return BadRequest(new { message = "Invalid status." });
        if (request.AssignedToUserId.HasValue &&
            !await _context.Users.AnyAsync(u => u.ID == request.AssignedToUserId.Value))
            return BadRequest(new { message = "Assigned user not found." });

        var oldSummary = $"{ticket.Subject} | Status {ticket.Status.StatusName}";
        ticket.Subject = request.Subject;
        ticket.Description = request.Description;
        ticket.CategoryId = request.CategoryId;
        ticket.PriorityId = request.PriorityId;
        ticket.StatusId = request.StatusId;
        ticket.AssignedToUserId = request.AssignedToUserId;
        ticket.ResolutionNotes = request.ResolutionNotes;
        ticket.UpdatedAt = DateTime.UtcNow;

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = userId,
            Action = "Ticket updated",
            OldValue = oldSummary,
            NewValue = ticket.Subject,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return Ok(new { message = "Ticket updated successfully." });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteTicket(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var ticket = await _context.Tickets.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });

        ticket.IsDeleted = true;
        ticket.UpdatedAt = DateTime.UtcNow;

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = userId,
            Action = "Ticket deleted",
            OldValue = "Active",
            NewValue = "Deleted",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return Ok(new { message = "Ticket deleted successfully." });
    }

    [HttpGet("my-tickets")]
    [Authorize(Roles = "Employee")]
    public async Task<IActionResult> GetMyTickets()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var tickets = await _context.Tickets
            .AsNoTracking()
            .Where(t => t.CreatedByUserId == userId && !t.IsDeleted)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TicketResponse
            {
                Id = t.Id,
                TicketNumber = t.TicketNumber,
                Subject = t.Subject,
                Description = t.Description,
                Category = t.Category.Name,
                Priority = t.Priority.Name,
                Status = t.Status.StatusName,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        return Ok(tickets);
    }

    [HttpGet("{id:int}/comments")]
    [Authorize]
    public async Task<IActionResult> GetComments(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        if (!await CanAccessTicketAsync(id, userId))
            return Forbid();

        var comments = await _context.TicketComments
            .AsNoTracking()
            .Where(c => c.TicketID == id && !c.IsInternal)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                id = c.ID,
                comment = c.Comment,
                createdAt = c.CreatedAt,
                parentCommentID = c.ParentCommentID,
                author = new
                {
                    id = c.User.ID,
                    name = c.User.FullName,
                    role = c.User.Role != null ? c.User.Role.Name : "User"
                },
                attachments = c.Attachments
                    .OrderBy(a => a.UploadedAt)
                    .Select(a => new
                    {
                        id = a.Id,
                        fileName = a.OriginalFileName,
                        contentType = a.ContentType,
                        fileSize = a.FileSize,
                        uploadedAt = a.UploadedAt,
                        downloadUrl = $"/api/tickets/{id}/attachments/{a.Id}/download"
                    })
                    .ToList()
            })
            .ToListAsync();

        return Ok(comments);
    }

   [HttpPost("{id:int}/comments")]
[Authorize(Roles = "Employee,IT Support Agent,Agent")]
public async Task<IActionResult> AddComment(int id, AddTicketCommentRequest request)
{
    if (!TryGetCurrentUserId(out var userId))
        return Unauthorized(new { message = "Invalid or missing user ID in token." });

    if (!await CanAccessTicketAsync(id, userId))
        return Forbid();

    if (request == null || string.IsNullOrWhiteSpace(request.Comment))
        return BadRequest(new { message = "Comment cannot be empty." });

    var ticket = await _context.Tickets
        .Include(t => t.Status)
        .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

    if (ticket == null)
        return NotFound(new { message = "Ticket not found." });

    if (IsStatus(ticket, "Closed"))
        return BadRequest(new { message = "Closed tickets are read-only." });

    if (request.ParentCommentID.HasValue)
    {
        var parentComment = await _context.TicketComments
            .FirstOrDefaultAsync(c =>
                c.ID == request.ParentCommentID.Value &&
                c.TicketID == id &&
                !c.IsInternal);

        if (parentComment == null)
        {
            return BadRequest(new
            {
                message = "Parent comment was not found on this ticket."
            });
        }
    }

    var author = await _context.Users
        .FirstAsync(u => u.ID == userId);

    var now = DateTime.UtcNow;

    var comment = new TicketComment
    {
        Comment = request.Comment.Trim(),
        CreatedAt = now,
        TicketID = ticket.Id,
        UserID = userId,
        IsInternal = false,
        ParentCommentID = request.ParentCommentID
    };

    _context.TicketComments.Add(comment);

    ticket.UpdatedAt = now;

    _context.TicketActivityLogs.Add(new TicketActivityLog
    {
        TicketID = ticket.Id,
        PerformedByUserID = userId,
        ActivityType = request.ParentCommentID.HasValue
            ? "Comment Reply Added"
            : "Comment Added",
        Description = request.ParentCommentID.HasValue
            ? $"{author.FullName} added a reply."
            : $"{author.FullName} added a comment.",
        CreatedAt = now
    });

    var recipientIds = new List<int>();

    if (userId == ticket.CreatedByUserId)
    {
        if (ticket.AssignedToUserId.HasValue)
            recipientIds.Add(ticket.AssignedToUserId.Value);
    }
    else
    {
        recipientIds.Add(ticket.CreatedByUserId);
    }

    await _notificationService.CreateNotificationsAsync(
        recipientIds
            .Where(recipientId => recipientId != userId)
            .Distinct(),
        request.ParentCommentID.HasValue
            ? "New Ticket Reply"
            : "New Ticket Comment",
        request.ParentCommentID.HasValue
            ? $"{author.FullName} replied on {ticket.TicketNumber} - {ticket.Subject}."
            : $"{author.FullName} commented on {ticket.TicketNumber} - {ticket.Subject}.",
        request.ParentCommentID.HasValue
            ? "CommentReply"
            : "CommentAdded",
        ticket.Id
    );

    await _context.SaveChangesAsync();

    return Ok(new
    {
        message = request.ParentCommentID.HasValue
            ? "Reply added successfully."
            : "Comment added successfully.",

        comment = new
        {
            id = comment.ID,
            comment = comment.Comment,
            createdAt = comment.CreatedAt,
            userId = comment.UserID,
            isInternal = comment.IsInternal,
            parentCommentID = comment.ParentCommentID
        }
    });
}

    [HttpGet("{id:int}/internal-notes")]
    [Authorize(Roles = "IT Support Agent,Agent,Manager,Admin")]
    public async Task<IActionResult> GetInternalNotes(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        if (!await CanAccessTicketAsync(id, userId, allowEmployee: false))
            return Forbid();

        var notes = await _context.TicketComments
            .AsNoTracking()
            .Where(c => c.TicketID == id && c.IsInternal)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                id = c.ID,
                note = c.Comment,
                createdAt = c.CreatedAt,
                author = new
                {
                    id = c.User.ID,
                    name = c.User.FullName,
                    role = c.User.Role != null ? c.User.Role.Name : "User"
                },
                attachments = c.Attachments
                    .OrderBy(a => a.UploadedAt)
                    .Select(a => new
                    {
                        id = a.Id,
                        fileName = a.OriginalFileName,
                        contentType = a.ContentType,
                        fileSize = a.FileSize,
                        uploadedAt = a.UploadedAt,
                        downloadUrl = $"/api/tickets/{id}/attachments/{a.Id}/download"
                    })
                    .ToList()
            })
            .ToListAsync();

        return Ok(notes);
    }

    [HttpPost("{id:int}/internal-notes")]
    [Authorize(Roles = "IT Support Agent,Agent,Manager,Admin")]
    public async Task<IActionResult> AddInternalNote(int id, InternalNoteRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        if (!await CanAccessTicketAsync(id, userId, allowEmployee: false))
            return Forbid();

        if (request == null || string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "Internal note cannot be empty." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });

        if (IsStatus(ticket, "Closed"))
            return BadRequest(new { message = "Closed tickets are read-only." });

        var now = DateTime.UtcNow;

        var note = new TicketComment
        {
            TicketID = ticket.Id,
            UserID = userId,
            Comment = request.Note.Trim(),
            IsInternal = true,
            ParentCommentID = null,
            CreatedAt = now
        };

        _context.TicketComments.Add(note);
        ticket.UpdatedAt = now;

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = userId,
            ActivityType = "Internal Note Added",
            Description = "An internal note was added.",
            CreatedAt = now
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Internal note added successfully.",
            note = new
            {
                id = note.ID,
                note = note.Comment,
                createdAt = note.CreatedAt
            }
        });
    }

    [HttpGet("{id:int}/activity")]
    [Authorize]
    public async Task<IActionResult> GetActivity(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });
        if (!await CanAccessTicketAsync(id, userId))
            return Forbid();

        var role = CurrentRole();
        var logs = _context.TicketActivityLogs
            .AsNoTracking()
            .Where(log => log.TicketID == id);

        if (role.Equals("Employee", StringComparison.OrdinalIgnoreCase))
            logs = logs.Where(log => !log.ActivityType.StartsWith("Internal Note"));

        var activity = await logs
            .OrderByDescending(log => log.CreatedAt)
            .Select(log => new
            {
                id = log.ID,
                activityType = log.ActivityType,
                description = log.Description,
                progressPercent = log.ProgressPercent,
                createdAt = log.CreatedAt,
                performedBy = new
                {
                    id = log.PerformedByUser.ID,
                    name = log.PerformedByUser.FullName
                }
            })
            .ToListAsync();

        return Ok(activity);
    }

    [HttpGet("{id:int}/history")]
    [Authorize]
    public async Task<IActionResult> GetHistory(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var role = CurrentRole();
        if (role.Equals("Employee", StringComparison.OrdinalIgnoreCase))
            return Forbid();
        if (!await CanAccessTicketAsync(id, userId, allowEmployee: false))
            return Forbid();

        var history = await _context.TicketHistories
            .AsNoTracking()
            .Where(item => item.TicketID == id)
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                id = item.ID,
                action = item.Action,
                oldValue = item.OldValue,
                newValue = item.NewValue,
                createdAt = item.CreatedAt,
                changedBy = new
                {
                    id = item.ChangedByUser.ID,
                    name = item.ChangedByUser.FullName,
                    role = item.ChangedByUser.Role != null ? item.ChangedByUser.Role.Name : "User"
                }
            })
            .ToListAsync();

        return Ok(history);
    }

    [HttpPost("{id:int}/assign")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> AssignTicket(int id, AssignTicketRequest request)
    {
        if (!TryGetCurrentUserId(out var assignedByUserId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });
        if (IsStatus(ticket, "Closed") || IsStatus(ticket, "Cancelled"))
            return BadRequest(new { message = "Cannot assign a closed or cancelled ticket." });

        var agent = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.ID == request.AgentUserId);
        if (agent == null)
            return BadRequest(new { message = "Agent user not found." });
        if (!IsAgentRole(agent.Role?.Name ?? string.Empty))
            return BadRequest(new { message = "The assigned user is not an agent." });
        if (ticket.AssignedToUserId == agent.ID)
            return BadRequest(new { message = "This ticket is already assigned to that agent." });

        var now = DateTime.UtcNow;
        var previousAgentName = ticket.AssignedToUser?.FullName;

        await EndCurrentAssignmentAsync(ticket.Id, now,
            previousAgentName == null ? "Assignment replaced." : $"Reassigned to {agent.FullName}.");
        await EndActiveWorkSessionsAsync(ticket.Id, now, "Ticket reassigned");

        _context.TicketAssignments.Add(new TicketAssignment
        {
            TicketID = ticket.Id,
            AgentUserID = agent.ID,
            AssignedByUserID = assignedByUserId,
            AssignedAt = now
        });

        ticket.AssignedToUserId = agent.ID;
        ticket.UpdatedAt = now;

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = assignedByUserId,
            Action = previousAgentName == null ? "Ticket assigned" : "Ticket reassigned",
            OldValue = previousAgentName,
            NewValue = agent.FullName,
            CreatedAt = now
        });

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = assignedByUserId,
            ActivityType = previousAgentName == null ? "Assigned" : "Reassigned",
            Description = previousAgentName == null
                ? $"Ticket assigned to {agent.FullName}."
                : $"Ticket reassigned from {previousAgentName} to {agent.FullName}.",
            CreatedAt = now
        });

        await _notificationService.CreateNotificationAsync(
            agent.ID,
            previousAgentName == null ? "New Ticket Assigned" : "Ticket Reassigned",
            $"{ticket.TicketNumber} - {ticket.Subject} has been assigned to you.",
            previousAgentName == null ? "TicketAssigned" : "TicketReassigned",
            ticket.Id
        );

        if (ticket.CreatedByUserId != agent.ID)
        {
            await _notificationService.CreateNotificationAsync(
                ticket.CreatedByUserId,
                "Ticket Assigned",
                $"{ticket.TicketNumber} has been assigned to {agent.FullName}.",
                "TicketAssigned",
                ticket.Id
            );
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The ticket assignment changed. Refresh and try again." });
        }

        return Ok(new
        {
            message = $"Ticket assigned to {agent.FullName}.",
            assignedAgent = new { id = agent.ID, name = agent.FullName }
        });
    }

    [HttpGet("assignment-options")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> GetAssignmentOptions()
    {
        var tickets = await _context.Tickets
            .AsNoTracking()
            .Where(t =>
                !t.IsDeleted &&
                t.AssignedToUserId == null &&
                t.Status.StatusName != "Closed" &&
                t.Status.StatusName != "Cancelled" &&
                t.Status.StatusName != "Resolved")
            .OrderBy(t => t.CreatedAt)
            .Select(t => new
            {
                id = t.Id,
                ticketNumber = t.TicketNumber,
                subject = t.Subject,
                category = t.Category.Name,
                priority = t.Priority.Name,
                status = t.Status.StatusName,
                createdAt = t.CreatedAt
            })
            .ToListAsync();

        var agents = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role != null &&
                (u.Role.Name.ToLower() == "it support agent" || u.Role.Name.ToLower() == "agent" || u.Role.Name.ToLower() == "it"))
            .Select(u => new
            {
                id = u.ID,
                name = u.FullName,
                activeTickets = _context.Tickets.Count(t =>
                    t.AssignedToUserId == u.ID &&
                    !t.IsDeleted &&
                    t.Status.StatusName != "Closed" &&
                    t.Status.StatusName != "Resolved" &&
                    t.Status.StatusName != "Cancelled")
            })
            .OrderBy(a => a.activeTickets)
            .ThenBy(a => a.name)
            .ToListAsync();

        return Ok(new { tickets, agents });
    }

    [HttpPost("{id:int}/take")]
    [Authorize(Roles = "IT Support Agent,Agent")]
    public async Task<IActionResult> TakeTicket(int id)
    {
        if (!TryGetCurrentUserId(out var agentUserId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });
        if (ticket.AssignedToUserId != null)
            return Conflict(new { message = "Ticket is already assigned." });
        if (IsStatus(ticket, "Closed") || IsStatus(ticket, "Resolved") || IsStatus(ticket, "Cancelled"))
            return BadRequest(new { message = "Cannot take a closed, resolved, or cancelled ticket." });

        var agent = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.ID == agentUserId);
        if (agent == null)
            return Unauthorized(new { message = "Agent user not found." });
        if (!IsAgentRole(agent.Role?.Name ?? string.Empty))
            return Forbid();

        var now = DateTime.UtcNow;
        ticket.AssignedToUserId = agentUserId;
        ticket.UpdatedAt = now;

        _context.TicketAssignments.Add(new TicketAssignment
        {
            TicketID = ticket.Id,
            AgentUserID = agentUserId,
            AssignedByUserID = agentUserId,
            AssignedAt = now
        });

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = agentUserId,
            Action = "Ticket taken",
            OldValue = null,
            NewValue = agent.FullName,
            CreatedAt = now
        });

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = agentUserId,
            ActivityType = "Taken",
            Description = $"{agent.FullName} took the ticket.",
            CreatedAt = now
        });

        await _notificationService.CreateNotificationAsync(
            ticket.CreatedByUserId,
            "Ticket Assigned",
            $"{ticket.TicketNumber} has been taken by {agent.FullName}.",
            "TicketAssigned",
            ticket.Id
        );

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The ticket assignment changed. Refresh and try again." });
        }

        return Ok(new
        {
            message = "Ticket taken successfully.",
            ticketId = ticket.Id,
            ticketNumber = ticket.TicketNumber
        });
    }

    [HttpPost("{id:int}/start-work")]
    [Authorize(Roles = "IT Support Agent,Agent")]
    public async Task<IActionResult> StartWork(int id)
    {
        if (!TryGetCurrentUserId(out var agentUserId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted && t.AssignedToUserId == agentUserId);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found or not assigned to you." });
        if (IsStatus(ticket, "Closed") || IsStatus(ticket, "Resolved") || IsStatus(ticket, "Cancelled"))
            return BadRequest(new { message = "Cannot start work on a closed, resolved, or cancelled ticket." });

        var activeSession = await _context.TicketWorkSessions
            .FirstOrDefaultAsync(session => session.AgentUserID == agentUserId && session.EndedAt == null);
        if (activeSession != null)
        {
            return Conflict(new
            {
                message = activeSession.TicketID == ticket.Id
                    ? "You already have an active work session on this ticket."
                    : "You already have an active work session on another ticket.",
                activeTicketId = activeSession.TicketID
            });
        }

        var now = DateTime.UtcNow;
        var workSession = new TicketWorkSession
        {
            TicketID = ticket.Id,
            AgentUserID = agentUserId,
            StartAt = now
        };

        _context.TicketWorkSessions.Add(workSession);
        ticket.UpdatedAt = now;

        var inProgressStatus = await _context.Statuses
            .FirstOrDefaultAsync(status => status.StatusName.ToLower() == "in progress");

        if (inProgressStatus != null && !IsStatus(ticket, "In Progress"))
        {
            var previousStatus = ticket.Status.StatusName;
            ticket.StatusId = inProgressStatus.ID;
            _context.TicketHistories.Add(new TicketHistory
            {
                TicketID = ticket.Id,
                ChangedByUserID = agentUserId,
                Action = "Status changed",
                OldValue = previousStatus,
                NewValue = "In Progress",
                CreatedAt = now
            });
        }

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = agentUserId,
            ActivityType = "Work Started",
            Description = "Work session started.",
            CreatedAt = now
        });

        await _context.SaveChangesAsync();
        return Ok(new
        {
            message = "Work session started.",
            sessionId = workSession.ID,
            startedAt = workSession.StartAt,
            status = inProgressStatus != null ? "In Progress" : ticket.Status.StatusName
        });
    }

    [HttpPost("{id:int}/pause-work")]
    [Authorize(Roles = "IT Support Agent,Agent")]
    public async Task<IActionResult> PauseWork(int id)
    {
        if (!TryGetCurrentUserId(out var agentUserId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var ticket = await _context.Tickets.FirstOrDefaultAsync(t =>
            t.Id == id && !t.IsDeleted && t.AssignedToUserId == agentUserId);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found or not assigned to you." });

        var activeSession = await _context.TicketWorkSessions.FirstOrDefaultAsync(session =>
            session.TicketID == id && session.AgentUserID == agentUserId && session.EndedAt == null);
        if (activeSession == null)
            return BadRequest(new { message = "No active work session found for this ticket." });

        var now = DateTime.UtcNow;
        activeSession.EndedAt = now;
        activeSession.DurationMinutes = Math.Max(1, (int)Math.Ceiling((now - activeSession.StartAt).TotalMinutes));
        activeSession.StopReason = "Paused";
        ticket.UpdatedAt = now;

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = id,
            PerformedByUserID = agentUserId,
            ActivityType = "Work Paused",
            Description = $"Work session paused after {activeSession.DurationMinutes} minutes.",
            CreatedAt = now
        });

        await _context.SaveChangesAsync();
        return Ok(new
        {
            message = "Work session paused.",
            sessionId = activeSession.ID,
            endedAt = activeSession.EndedAt,
            durationMinutes = activeSession.DurationMinutes
        });
    }

    [HttpPost("{id:int}/resolve")]
    [Authorize(Roles = "IT Support Agent,Agent")]
    public async Task<IActionResult> ResolveTicket(int id, TicketActionRequest request)
    {
        if (!TryGetCurrentUserId(out var agentUserId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });
        if (request == null || string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "Resolution notes are required." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });
        if (ticket.AssignedToUserId != agentUserId)
            return Forbid();
        if (IsStatus(ticket, "Closed") || IsStatus(ticket, "Cancelled"))
            return BadRequest(new { message = "A closed or cancelled ticket cannot be resolved." });
        if (IsStatus(ticket, "Resolved"))
            return BadRequest(new { message = "This ticket is already resolved." });

        var resolvedStatus = await _context.Statuses
            .FirstOrDefaultAsync(status => status.StatusName.ToLower() == "resolved");
        if (resolvedStatus == null)
            return BadRequest(new { message = "Resolved status was not found." });

        var now = DateTime.UtcNow;
        var previousStatus = ticket.Status.StatusName;
        await EndActiveWorkSessionsAsync(ticket.Id, now, "Ticket resolved");

        ticket.StatusId = resolvedStatus.ID;
        ticket.ResolutionNotes = request.Note.Trim();
        ticket.ResolvedAt = now;
        ticket.ProgressPercentage = 100;
        ticket.UpdatedAt = now;

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = agentUserId,
            Action = "Ticket resolved",
            OldValue = previousStatus,
            NewValue = "Resolved",
            CreatedAt = now
        });

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = agentUserId,
            ActivityType = "Resolved",
            Description = $"Ticket resolved. Resolution: {ticket.ResolutionNotes}",
            ProgressPercent = 100,
            CreatedAt = now
        });

        var recipients = (await GetManagersAndAdminsAsync())
            .Append(ticket.CreatedByUserId)
            .Where(userId => userId != agentUserId)
            .Distinct()
            .ToList();

        await _notificationService.CreateNotificationsAsync(
            recipients,
            "Ticket Resolved",
            $"{ticket.TicketNumber} - {ticket.Subject} was resolved by {ticket.AssignedToUser?.FullName ?? "the assigned agent"}.",
            "TicketResolved",
            ticket.Id
        );

        await _context.SaveChangesAsync();
        return Ok(new
        {
            message = "Ticket resolved successfully.",
            status = "Resolved",
            resolvedAt = ticket.ResolvedAt
        });
    }

    [HttpPost("{id:int}/escalate")]
    [Authorize(Roles = "IT Support Agent,Agent")]
    public async Task<IActionResult> EscalateTicket(int id, TicketActionRequest request)
    {
        if (!TryGetCurrentUserId(out var agentUserId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });
        if (request == null || string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "Escalation reason is required." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });
        if (ticket.AssignedToUserId != agentUserId)
            return Forbid();
        if (IsStatus(ticket, "Closed") || IsStatus(ticket, "Resolved") || IsStatus(ticket, "Cancelled"))
            return BadRequest(new { message = "This ticket cannot be escalated in its current state." });

        var openStatus = await _context.Statuses.FirstOrDefaultAsync(status => status.StatusName.ToLower() == "open");
        if (openStatus == null)
            return BadRequest(new { message = "Open status was not found." });

        var now = DateTime.UtcNow;
        var agentName = ticket.AssignedToUser?.FullName ?? "Assigned agent";
        var previousStatus = ticket.Status.StatusName;
        var reason = request.Note.Trim();

        await EndActiveWorkSessionsAsync(ticket.Id, now, "Ticket escalated");
        await EndCurrentAssignmentAsync(ticket.Id, now, $"Escalated: {reason}");

        ticket.AssignedToUserId = null;
        ticket.StatusId = openStatus.ID;
        ticket.UpdatedAt = now;

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = agentUserId,
            Action = "Ticket escalated",
            OldValue = $"{previousStatus} / {agentName}",
            NewValue = $"Open / Unassigned - {reason}",
            CreatedAt = now
        });

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = agentUserId,
            ActivityType = "Escalated",
            Description = $"{agentName} returned the ticket to the manager for reassignment. Reason: {reason}",
            CreatedAt = now
        });

        var managersAndAdmins = await GetManagersAndAdminsAsync();
        await _notificationService.CreateNotificationsAsync(
            managersAndAdmins,
            "Ticket Escalated",
            $"{ticket.TicketNumber} - {ticket.Subject} was escalated by {agentName} and needs reassignment.",
            "TicketEscalated",
            ticket.Id
        );

        await _notificationService.CreateNotificationAsync(
            ticket.CreatedByUserId,
            "Ticket Escalated",
            $"{ticket.TicketNumber} has been returned for reassignment.",
            "TicketEscalated",
            ticket.Id
        );

        await _context.SaveChangesAsync();
        return Ok(new
        {
            message = "Ticket escalated successfully and returned to the manager for reassignment.",
            status = "Open",
            assignedAgent = (object?)null
        });
    }

    [HttpPost("{id:int}/return-to-manager")]
    [Authorize(Roles = "IT Support Agent,Agent")]
    public async Task<IActionResult> ReturnToManager(int id, TicketActionRequest request)
    {
        if (!TryGetCurrentUserId(out var agentUserId))
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
        if (IsStatus(ticket, "Closed") || IsStatus(ticket, "Resolved") || IsStatus(ticket, "Cancelled"))
            return BadRequest(new { message = "This ticket cannot be returned in its current state." });

        var openStatus = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName.ToLower() == "open");
        if (openStatus == null)
            return BadRequest(new { message = "Open status was not found." });

        var now = DateTime.UtcNow;
        var agentName = ticket.AssignedToUser?.FullName ?? "Assigned agent";
        var previousStatus = ticket.Status.StatusName;
        var reason = request.Note.Trim();

        await EndActiveWorkSessionsAsync(ticket.Id, now, "Returned to manager: " + reason);
        await EndCurrentAssignmentAsync(ticket.Id, now, "Agent could not resolve: " + reason);

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

        var managersAndAdmins = await GetManagersAndAdminsAsync();
        await _notificationService.CreateNotificationsAsync(
            managersAndAdmins,
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

    [HttpPost("{id:int}/cancel")]
[Authorize(Roles = "IT Support Agent,Agent")]
public async Task<IActionResult> CancelTicket(
    int id,
    TicketActionRequest request)
{
    if (!TryGetCurrentUserId(out var agentUserId))
        return Unauthorized(new
        {
            message = "Invalid or missing user ID in token."
        });

    if (request == null || string.IsNullOrWhiteSpace(request.Note))
        return BadRequest(new
        {
            message = "A reason is required."
        });

    var ticket = await _context.Tickets
        .Include(t => t.Status)
        .Include(t => t.AssignedToUser)
        .FirstOrDefaultAsync(t =>
            t.Id == id &&
            !t.IsDeleted);

    if (ticket == null)
        return NotFound(new
        {
            message = "Ticket not found."
        });

    if (ticket.AssignedToUserId != agentUserId)
        return Forbid();

    if (IsStatus(ticket, "Closed") ||
        IsStatus(ticket, "Resolved") ||
        IsStatus(ticket, "Cancelled"))
    {
        return BadRequest(new
        {
            message = "This ticket cannot be returned in its current state."
        });
    }

    var openStatus = await _context.Statuses
        .FirstOrDefaultAsync(s =>
            s.StatusName.ToLower() == "open");

    if (openStatus == null)
        return BadRequest(new
        {
            message = "Open status was not found."
        });

    var now = DateTime.UtcNow;

    var previousStatus = ticket.Status.StatusName;

    var agentName =
        ticket.AssignedToUser?.FullName ??
        "Assigned agent";

    var reason = request.Note.Trim();

    // Stop any active work session
    await EndActiveWorkSessionsAsync(
        ticket.Id,
        now,
        "Agent stopped working: " + reason
    );

    // End the current assignment history
    await EndCurrentAssignmentAsync(
        ticket.Id,
        now,
        "Returned for reassignment: " + reason
    );

    // IMPORTANT:
    // Put ticket back into manager's Needs Attention queue
    ticket.AssignedToUserId = null;
    ticket.StatusId = openStatus.ID;
    ticket.UpdatedAt = now;

    _context.TicketHistories.Add(new TicketHistory
    {
        TicketID = ticket.Id,
        ChangedByUserID = agentUserId,
        Action = "Returned for reassignment",
        OldValue = $"{previousStatus} / {agentName}",
        NewValue = $"Open / Unassigned - {reason}",
        CreatedAt = now
    });

    _context.TicketActivityLogs.Add(new TicketActivityLog
    {
        TicketID = ticket.Id,
        PerformedByUserID = agentUserId,
        ActivityType = "Returned to Manager",
        Description =
            $"{agentName} stopped working on the ticket and returned it for reassignment. Reason: {reason}",
        CreatedAt = now
    });

    // Notify manager(s) that the ticket needs attention
    var managerIds =
        await _notificationService.GetUserIdsByRoleAsync("Manager");

    await _notificationService.CreateNotificationsAsync(
        managerIds,
        "Ticket Needs Attention",
        $"{ticket.TicketNumber} - {ticket.Subject} was returned by {agentName} and needs reassignment.",
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

    [HttpPost("{id:int}/reopen")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> ReopenTicket(int id, TicketActionRequest request)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });
        if (request == null || string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "Reopen reason is required." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });
        if (!IsStatus(ticket, "Resolved") && !IsStatus(ticket, "Closed") && !IsStatus(ticket, "Cancelled"))
            return BadRequest(new { message = "Only resolved, closed, or cancelled tickets can be reopened." });

        var reopenedStatus = await _context.Statuses.FirstOrDefaultAsync(status => status.StatusName.ToLower() == "reopened");
        var openStatus = await _context.Statuses.FirstOrDefaultAsync(status => status.StatusName.ToLower() == "open");
        var targetStatus = reopenedStatus ?? openStatus;
        if (targetStatus == null)
            return BadRequest(new { message = "Reopened or Open status was not found." });

        var now = DateTime.UtcNow;
        var previousStatus = ticket.Status.StatusName;
        var previousAgentId = ticket.AssignedToUserId;
        var previousAgentName = ticket.AssignedToUser?.FullName;
        var reason = request.Note.Trim();

        await EndActiveWorkSessionsAsync(ticket.Id, now, "Ticket reopened for reassignment");
        await EndCurrentAssignmentAsync(ticket.Id, now, "Ticket reopened for manager reassignment");

        ticket.AssignedToUserId = null;
        ticket.StatusId = targetStatus.ID;
        ticket.ClosedAt = null;
        ticket.ResolvedAt = null;
        ticket.ProgressPercentage = 0;
        ticket.UpdatedAt = now;

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

        var otherManagersAndAdmins = (await GetManagersAndAdminsAsync())
            .Where(recipientId => recipientId != userId)
            .ToList();

        await _notificationService.CreateNotificationsAsync(
            otherManagersAndAdmins,
            "Ticket Reopened",
            $"{ticket.TicketNumber} - {ticket.Subject} was reopened and needs reassignment.",
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

    [HttpPost("{id:int}/close")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> CloseTicket(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid or missing user ID in token." });

        var ticket = await _context.Tickets
            .Include(t => t.Status)
            .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        if (ticket == null)
            return NotFound(new { message = "Ticket not found." });
        if (IsStatus(ticket, "Closed"))
            return BadRequest(new { message = "This ticket is already closed." });
        if (!IsStatus(ticket, "Resolved"))
            return BadRequest(new { message = "Only resolved tickets can be closed." });

        var closedStatus = await _context.Statuses.FirstOrDefaultAsync(status => status.StatusName.ToLower() == "closed");
        if (closedStatus == null)
            return BadRequest(new { message = "Closed status was not found." });

        var now = DateTime.UtcNow;
        await EndActiveWorkSessionsAsync(ticket.Id, now, "Ticket closed");
        await EndCurrentAssignmentAsync(ticket.Id, now, "Ticket closed");

        ticket.StatusId = closedStatus.ID;
        ticket.ClosedAt = now;
        ticket.ProgressPercentage = 100;
        ticket.UpdatedAt = now;

        _context.TicketHistories.Add(new TicketHistory
        {
            TicketID = ticket.Id,
            ChangedByUserID = userId,
            Action = "Ticket closed",
            OldValue = "Resolved",
            NewValue = "Closed",
            CreatedAt = now
        });

        _context.TicketActivityLogs.Add(new TicketActivityLog
        {
            TicketID = ticket.Id,
            PerformedByUserID = userId,
            ActivityType = "Closed",
            Description = "Ticket closed and made read-only.",
            ProgressPercent = 100,
            CreatedAt = now
        });

        var recipients = new List<int> { ticket.CreatedByUserId };
        if (ticket.AssignedToUserId.HasValue)
            recipients.Add(ticket.AssignedToUserId.Value);

        await _notificationService.CreateNotificationsAsync(
            recipients.Where(recipientId => recipientId != userId),
            "Ticket Closed",
            $"{ticket.TicketNumber} - {ticket.Subject} has been closed.",
            "TicketClosed",
            ticket.Id
        );

        await _context.SaveChangesAsync();
        return Ok(new
        {
            message = "Ticket closed successfully.",
            status = "Closed",
            closedAt = ticket.ClosedAt
        });
    }
}