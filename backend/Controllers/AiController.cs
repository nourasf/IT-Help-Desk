using System.Security.Claims;
using backend.Data;
using backend.DTOs.Ai;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly OllamaService _ollamaService;
    private readonly AppDbContext _context;

    public AiController(OllamaService ollamaService, AppDbContext context)
    {
        _ollamaService = ollamaService;
        _context = context;
    }

    private bool TryGetCurrentUserId(out int userId)
    {
        return int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
    }

    [HttpPost("analyze-ticket")]
    public async Task<IActionResult> AnalyzeTicket([FromBody] AiTicketAnalysisRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { message = "Subject and description are required." });

        var categories = await _context.Categories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync();

        var priorities = await _context.Priorities.AsNoTracking()
            .OrderBy(p => p.ID)
            .Select(p => p.Name)
            .ToListAsync();

        if (categories.Count == 0)
            return BadRequest(new { message = "No active categories are configured." });

        if (priorities.Count == 0)
            return BadRequest(new { message = "No priorities are configured." });

        var result = await _ollamaService.AnalyzeTicketAsync(request.Subject, request.Description, categories, priorities);

        var validCategory = categories.FirstOrDefault(c => string.Equals(c, result.Category, StringComparison.OrdinalIgnoreCase));
        var validPriority = priorities.FirstOrDefault(p => string.Equals(p, result.Priority, StringComparison.OrdinalIgnoreCase));

        if (validCategory == null || validPriority == null)
        {
            return StatusCode(502, new
            {
                message = "AI returned an invalid category or priority.",
                aiCategory = result.Category,
                aiPriority = result.Priority
            });
        }

        result.Category = validCategory;
        result.Priority = validPriority;
        return Ok(result);
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid user session." });

        var conversations = await _context.AiConversations
            .AsNoTracking()
            .Where(c => c.UserID == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .Take(10)
            .Select(c => new
            {
                id = c.ID,
                title = c.Title,
                createdAt = c.CreatedAt,
                updatedAt = c.UpdatedAt,
                messageCount = c.Messages.Count
            })
            .ToListAsync();

        return Ok(conversations);
    }

    [HttpGet("conversations/{id:int}")]
    public async Task<IActionResult> GetConversation(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid user session." });

        var conversation = await _context.AiConversations
            .AsNoTracking()
            .Where(c => c.ID == id && c.UserID == userId)
            .Select(c => new
            {
                id = c.ID,
                title = c.Title,
                createdAt = c.CreatedAt,
                updatedAt = c.UpdatedAt,
                messages = c.Messages
                    .OrderBy(m => m.CreatedAt)
                    .Select(m => new
                    {
                        id = m.ID,
                        role = m.Role,
                        text = m.Text,
                        createdAt = m.CreatedAt
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (conversation == null)
            return NotFound(new { message = "Conversation not found." });

        return Ok(conversation);
    }

    [HttpDelete("conversations/{id:int}")]
    public async Task<IActionResult> DeleteConversation(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid user session." });

        var conversation = await _context.AiConversations
            .FirstOrDefaultAsync(c => c.ID == id && c.UserID == userId);

        if (conversation == null)
            return NotFound(new { message = "Conversation not found." });

        _context.AiConversations.Remove(conversation);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("conversations")]
    public async Task<IActionResult> ClearConversations()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid user session." });

        var conversations = await _context.AiConversations
            .Where(c => c.UserID == userId)
            .ToListAsync();

        _context.AiConversations.RemoveRange(conversations);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "Message is required." });

        if (request.Message.Length > 2000)
            return BadRequest(new { message = "Message is too long." });

        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Invalid user session." });

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "Employee";
        AiConversation conversation;

        if (request.ConversationId.HasValue)
        {
            conversation = await _context.AiConversations
                .FirstOrDefaultAsync(c => c.ID == request.ConversationId.Value && c.UserID == userId)
                ?? throw new InvalidOperationException("Conversation not found.");
        }
        else
        {
            var title = request.Message.Trim();
            if (title.Length > 52)
                title = title[..52] + "…";

            conversation = new AiConversation
            {
                UserID = userId,
                Title = title,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.AiConversations.Add(conversation);
            await _context.SaveChangesAsync();
        }

        var history = await _context.AiConversationMessages
            .AsNoTracking()
            .Where(m => m.ConversationID == conversation.ID)
            .OrderByDescending(m => m.CreatedAt)
            .Take(10)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new AiChatHistoryMessage
            {
                Role = m.Role,
                Text = m.Text
            })
            .ToListAsync();

        var artifact = ResolveArtifact(request.Message, role);
        var reply = artifact?.Reply ?? await _ollamaService.ChatAsync(request.Message, history, role);
        var now = DateTime.UtcNow;

        _context.AiConversationMessages.AddRange(
            new AiConversationMessage
            {
                ConversationID = conversation.ID,
                Role = "user",
                Text = request.Message.Trim(),
                CreatedAt = now
            },
            new AiConversationMessage
            {
                ConversationID = conversation.ID,
                Role = "assistant",
                Text = reply,
                CreatedAt = now.AddMilliseconds(1)
            }
        );

        conversation.UpdatedAt = now;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            reply,
            role,
            conversationId = conversation.ID,
            title = conversation.Title,
            artifact = artifact == null ? null : new
            {
                type = artifact.Type,
                title = artifact.Title,
                initialData = artifact.InitialData
            }
        });
    }

    private static AiResolvedArtifact? ResolveArtifact(string message, string role)
    {
        var text = message.Trim().ToLowerInvariant();
        var normalizedRole = role.Trim().ToLowerInvariant();
        var isAdmin = normalizedRole == "admin";
        var isManager = normalizedRole == "manager";
        var isAgent = normalizedRole is "agent" or "it support agent";
        var isEmployee = normalizedRole == "employee";

        bool HasAny(params string[] terms) => terms.Any(text.Contains);

        if (isAdmin && HasAny("add a user", "add user", "create a user", "create user", "new user", "add an employee", "add employee", "add an agent", "add agent", "add a manager", "add manager"))
        {
            var suggestedRole = text.Contains("agent") ? "IT Support Agent"
                : text.Contains("manager") ? "Manager"
                : text.Contains("admin") ? "Admin"
                : "Employee";

            return new AiResolvedArtifact(
                "create_user",
                "Create User",
                "I've opened the Create User form. You can review the details before creating the account.",
                new Dictionary<string, object?> { ["role"] = suggestedRole }
            );
        }

        if (isAdmin && HasAny("show users", "view users", "list users", "all users", "user directory"))
            return new AiResolvedArtifact("user_list", "User Directory", "I've opened the user directory.", new Dictionary<string, object?>());

        if ((isAdmin || isManager) && HasAny("report", "analytics", "performance report"))
            return new AiResolvedArtifact("reports", "Reports", "I've opened the reporting workspace for you.", new Dictionary<string, object?>());

        if (isManager && HasAny("assign ticket", "assign a ticket", "assignment", "unassigned ticket", "unassigned tickets"))
        {
            var priority = text.Contains("critical") ? "Critical" : text.Contains("high") ? "High" : null;
            return new AiResolvedArtifact(
                "assignment_center",
                "Assignment Center",
                "I've opened the assignment center with the current unassigned queue.",
                new Dictionary<string, object?> { ["priority"] = priority }
            );
        }

        if ((isAdmin || isManager) && HasAny("show tickets", "view tickets", "all tickets", "critical tickets", "open tickets", "closed tickets", "resolved tickets"))
        {
            var priority = text.Contains("critical") ? "Critical" : text.Contains("high") ? "High" : null;
            var status = text.Contains("closed") ? "Closed"
                : text.Contains("resolved") ? "Resolved"
                : text.Contains("open") ? "Open"
                : null;

            return new AiResolvedArtifact(
                "ticket_list",
                "Ticket Explorer",
                "I've opened the ticket explorer with the closest matching filters.",
                new Dictionary<string, object?> { ["priority"] = priority, ["status"] = status }
            );
        }

        if (isAgent && HasAny("available tickets", "unassigned tickets", "new tickets", "tickets i can take"))
            return new AiResolvedArtifact("agent_available_tickets", "Available Tickets", "I've opened the available ticket queue.", new Dictionary<string, object?>());

        if (isAgent && HasAny("my tickets", "active tickets", "assigned tickets", "my active tickets"))
            return new AiResolvedArtifact("agent_my_tickets", "My Active Tickets", "I've opened your active ticket list.", new Dictionary<string, object?>());

        if (isEmployee && HasAny("create ticket", "create a ticket", "open ticket", "open a ticket", "report an issue", "report issue", "contact it", "contact support"))
            return new AiResolvedArtifact(
                "create_ticket",
                "Create Support Ticket",
                "I've opened a support ticket form. I carried your message into the description so you don't have to repeat yourself.",
                new Dictionary<string, object?> { ["description"] = message.Trim() }
            );

        if (isEmployee && HasAny("my tickets", "show my tickets", "view my tickets", "ticket history"))
            return new AiResolvedArtifact("my_tickets", "My Tickets", "I've opened your ticket list.", new Dictionary<string, object?>());

        return null;
    }

    private sealed record AiResolvedArtifact(
        string Type,
        string Title,
        string Reply,
        Dictionary<string, object?> InitialData
    );
}
