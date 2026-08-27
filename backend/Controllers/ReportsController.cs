using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _context;
    private static readonly string[] ActiveStatuses = { "Open", "New", "Assigned", "In Progress", "Pending", "Reopened", "Escalated" };

    public ReportsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetReport([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var today = DateTime.UtcNow.Date;
        var fromDate = (from ?? today.AddDays(-29)).Date;
        var toDate = (to ?? today).Date;

        if (fromDate > toDate)
            return BadRequest(new { message = "The 'from' date cannot be after the 'to' date." });

        if ((toDate - fromDate).TotalDays > 366)
            return BadRequest(new { message = "The reporting period cannot be longer than 366 days." });

        var endExclusive = toDate.AddDays(1);
        var ticketsInPeriod = _context.Tickets
            .AsNoTracking()
            .Where(t => !t.IsDeleted && t.CreatedAt >= fromDate && t.CreatedAt < endExclusive);

        var totalTickets = await ticketsInPeriod.CountAsync();
        var openTickets = await ticketsInPeriod.CountAsync(t => ActiveStatuses.Contains(t.Status.StatusName));
        var resolvedTickets = await ticketsInPeriod.CountAsync(t => t.Status.StatusName == "Resolved");
        var closedTickets = await ticketsInPeriod.CountAsync(t => t.Status.StatusName == "Closed");
        var unassignedTickets = await ticketsInPeriod.CountAsync(t =>
            t.AssignedToUserId == null &&
            t.Status.StatusName != "Resolved" &&
            t.Status.StatusName != "Closed" &&
            t.Status.StatusName != "Cancelled");
        var criticalTickets = await ticketsInPeriod.CountAsync(t =>
            t.Priority.Name == "Critical" &&
            t.Status.StatusName != "Resolved" &&
            t.Status.StatusName != "Closed" &&
            t.Status.StatusName != "Cancelled");

        var completedTickets = resolvedTickets + closedTickets;
        var resolutionRate = totalTickets == 0 ? 0 : Math.Round((double)completedTickets / totalTickets * 100, 1);

        var resolutionMinutes = await ticketsInPeriod
            .Where(t =>
                (t.Status.StatusName == "Resolved" || t.Status.StatusName == "Closed") &&
                (t.ResolvedAt.HasValue || t.ClosedAt.HasValue))
            .Select(t => EF.Functions.DateDiffMinute(t.CreatedAt, t.ResolvedAt ?? t.ClosedAt!.Value))
            .Where(minutes => minutes >= 0)
            .ToListAsync();

        var averageResolutionMinutes = resolutionMinutes.Count == 0 ? 0 : Math.Round(resolutionMinutes.Average(), 1);

        var completedWorkSessions = _context.TicketWorkSessions
            .AsNoTracking()
            .Where(session => session.StartAt >= fromDate && session.StartAt < endExclusive && session.EndedAt != null);

        var totalWorkMinutes = await completedWorkSessions.SumAsync(session => session.DurationMinutes ?? 0);
        var completedWorkSessionCount = await completedWorkSessions.CountAsync();
        var averageWorkMinutes = completedWorkSessionCount == 0 ? 0 : Math.Round((double)totalWorkMinutes / completedWorkSessionCount, 1);

        var ticketsByStatus = await ticketsInPeriod.GroupBy(t => t.Status.StatusName)
            .Select(group => new { name = group.Key, count = group.Count() })
            .OrderByDescending(item => item.count).ToListAsync();
        var ticketsByCategory = await ticketsInPeriod.GroupBy(t => t.Category.Name)
            .Select(group => new { name = group.Key, count = group.Count() })
            .OrderByDescending(item => item.count).ToListAsync();
        var ticketsByPriority = await ticketsInPeriod.GroupBy(t => t.Priority.Name)
            .Select(group => new { name = group.Key, count = group.Count() })
            .OrderByDescending(item => item.count).ToListAsync();

        var ticketDates = await ticketsInPeriod.Select(t => t.CreatedAt.Date).ToListAsync();
        var volumeLookup = ticketDates.GroupBy(date => date).ToDictionary(group => group.Key, group => group.Count());
        var dayCount = (toDate - fromDate).Days + 1;
        var ticketsByDay = Enumerable.Range(0, dayCount)
            .Select(offset => fromDate.AddDays(offset))
            .Select(date => new { date, label = date.ToString("MMM d"), count = volumeLookup.TryGetValue(date, out var count) ? count : 0 })
            .ToList();

        var agents = await _context.Users.AsNoTracking()
            .Where(user => user.Role != null && (user.Role.Name == "IT Support Agent" || user.Role.Name == "Agent" || user.Role.Name == "IT"))
            .OrderBy(user => user.FullName)
            .Select(user => new { user.ID, user.FullName, user.Email })
            .ToListAsync();

        var agentPerformance = new List<object>();
        foreach (var agent in agents)
        {
            var assignedDuringPeriod = await _context.TicketAssignments.AsNoTracking().CountAsync(assignment =>
                assignment.AgentUserID == agent.ID && assignment.AssignedAt >= fromDate && assignment.AssignedAt < endExclusive);

            var resolvedDuringPeriod = await _context.Tickets.AsNoTracking().CountAsync(ticket =>
                !ticket.IsDeleted && ticket.AssignedToUserId == agent.ID &&
                ((ticket.ResolvedAt.HasValue && ticket.ResolvedAt.Value >= fromDate && ticket.ResolvedAt.Value < endExclusive) ||
                 (ticket.ClosedAt.HasValue && ticket.ClosedAt.Value >= fromDate && ticket.ClosedAt.Value < endExclusive)));

            var activeTickets = await _context.Tickets.AsNoTracking().CountAsync(ticket =>
                !ticket.IsDeleted && ticket.AssignedToUserId == agent.ID && ActiveStatuses.Contains(ticket.Status.StatusName));

            var agentWorkQuery = _context.TicketWorkSessions.AsNoTracking().Where(session =>
                session.AgentUserID == agent.ID && session.StartAt >= fromDate && session.StartAt < endExclusive && session.EndedAt != null);

            var agentTotalWorkMinutes = await agentWorkQuery.SumAsync(session => session.DurationMinutes ?? 0);
            var agentWorkSessionCount = await agentWorkQuery.CountAsync();
            var agentAverageWorkMinutes = agentWorkSessionCount == 0 ? 0 : Math.Round((double)agentTotalWorkMinutes / agentWorkSessionCount, 1);

            var commentsAdded = await _context.TicketComments.AsNoTracking().CountAsync(comment =>
                comment.UserID == agent.ID && comment.CreatedAt >= fromDate && comment.CreatedAt < endExclusive);
            var activityCount = await _context.TicketActivityLogs.AsNoTracking().CountAsync(activity =>
                activity.PerformedByUserID == agent.ID && activity.CreatedAt >= fromDate && activity.CreatedAt < endExclusive);
            var reassignments = await _context.TicketAssignments.AsNoTracking().CountAsync(assignment =>
                assignment.AgentUserID == agent.ID && assignment.UnassignedAt.HasValue &&
                assignment.UnassignedAt.Value >= fromDate && assignment.UnassignedAt.Value < endExclusive);

            agentPerformance.Add(new
            {
                agentId = agent.ID,
                name = agent.FullName,
                email = agent.Email,
                assignedTickets = assignedDuringPeriod,
                resolvedTickets = resolvedDuringPeriod,
                activeTickets,
                totalWorkMinutes = agentTotalWorkMinutes,
                averageWorkMinutes = agentAverageWorkMinutes,
                commentsAdded,
                activityCount,
                reassignments
            });
        }

        var recentTickets = await ticketsInPeriod.OrderByDescending(t => t.CreatedAt).Take(10)
            .Select(t => new
            {
                id = t.Id,
                ticketNumber = t.TicketNumber,
                subject = t.Subject,
                employee = t.CreatedByUser.FullName,
                assignedTo = t.AssignedToUser != null ? t.AssignedToUser.FullName : "Unassigned",
                category = t.Category.Name,
                priority = t.Priority.Name,
                status = t.Status.StatusName,
                createdAt = t.CreatedAt
            }).ToListAsync();

        return Ok(new
        {
            from = fromDate,
            to = toDate,
            summary = new
            {
                totalTickets,
                openTickets,
                resolvedTickets,
                closedTickets,
                unassignedTickets,
                criticalTickets,
                resolutionRate,
                averageResolutionMinutes,
                totalWorkMinutes,
                averageWorkMinutes
            },
            charts = new { ticketsByDay, ticketsByStatus, ticketsByCategory, ticketsByPriority },
            agentPerformance,
            recentTickets
        });
    }
}
