using backend.Data;
using backend.DTOs.Ai;
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

    public AiController(
        OllamaService ollamaService,
        AppDbContext context)
    {
        _ollamaService = ollamaService;
        _context = context;
    }

    [HttpPost("analyze-ticket")]
    public async Task<IActionResult> AnalyzeTicket(
        [FromBody] AiTicketAnalysisRequest request)
    {
        if (request == null ||
            string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new
            {
                message = "Subject and description are required."
            });
        }

        var categories = await _context.Categories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync();

        var priorities = await _context.Priorities
            .AsNoTracking()
            .OrderBy(p => p.ID)
            .Select(p => p.Name)
            .ToListAsync();

        if (categories.Count == 0)
        {
            return BadRequest(new
            {
                message = "No active categories are configured."
            });
        }

        if (priorities.Count == 0)
        {
            return BadRequest(new
            {
                message = "No priorities are configured."
            });
        }

        var result = await _ollamaService.AnalyzeTicketAsync(
            request.Subject,
            request.Description,
            categories,
            priorities
        );

        var validCategory = categories.FirstOrDefault(
            c => string.Equals(
                c,
                result.Category,
                StringComparison.OrdinalIgnoreCase
            )
        );

        var validPriority = priorities.FirstOrDefault(
            p => string.Equals(
                p,
                result.Priority,
                StringComparison.OrdinalIgnoreCase
            )
        );

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

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new
            {
                message = "Message is required."
            });
        }

        var reply = await _ollamaService.ChatAsync(request.Message);

        return Ok(new
        {
            reply
        });
    }
}
