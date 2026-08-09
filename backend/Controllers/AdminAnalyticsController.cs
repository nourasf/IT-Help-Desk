using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/admin-analytics")]
[Authorize(Roles = "Admin")]
public class AdminAnalyticsController : ControllerBase
{
    private readonly AppDbContext _context;

    public AdminAnalyticsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("resolved-last-30-days")]
    public async Task<IActionResult> GetResolvedLast30Days()
    {
        var startDate = DateTime.UtcNow.Date.AddDays(-29);

        var resolvedDates = await _context.Tickets
            .AsNoTracking()
            .Where(t =>
                !t.IsDeleted &&
                (t.Status.StatusName == "Resolved" || t.Status.StatusName == "Closed") &&
                (t.ResolvedAt.HasValue || t.ClosedAt.HasValue || t.UpdatedAt.HasValue))
            .Select(t => t.ResolvedAt ?? t.ClosedAt ?? t.UpdatedAt)
            .Where(value => value.HasValue && value.Value >= startDate)
            .Select(value => value!.Value.Date)
            .ToListAsync();

        var grouped = resolvedDates
            .GroupBy(date => date)
            .ToDictionary(group => group.Key, group => group.Count());

        var points = Enumerable.Range(0, 30)
            .Select(offset => startDate.AddDays(offset))
            .Select(date => new
            {
                date,
                label = date.ToString("MMM d"),
                count = grouped.TryGetValue(date, out var count) ? count : 0
            })
            .ToList();

        return Ok(new
        {
            total = points.Sum(point => point.count),
            from = startDate,
            to = DateTime.UtcNow.Date,
            points
        });
    }
}
