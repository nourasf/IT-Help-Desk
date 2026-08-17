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

        var result = await _ollamaService.AnalyzeTicketAsync(
            request.Subject,
            request.Description,
            categories,
            priorities
        );

        var validCategory = categories.FirstOrDefault(c =>
            string.Equals(c, result.Category, StringComparison.OrdinalIgnoreCase));

        var validPriority = priorities.FirstOrDefault(p =>
            string.Equals(p, result.Priority, StringComparison.OrdinalIgnoreCase));

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

        var reply = await _ollamaService.ChatAsync(request.Message, history, role);
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
            title = conversation.Title
        });
    }
}
