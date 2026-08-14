using backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("employee")]
        public async Task<IActionResult> GetEmployeeDashboard()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var ticketsQuery = _context.Tickets
                .AsNoTracking()
                .Where(t => t.CreatedByUserId == userId && !t.IsDeleted);

            var openTickets = await ticketsQuery.CountAsync(t => t.Status.StatusName == "Open");
            var pendingTickets = await ticketsQuery.CountAsync(t => t.Status.StatusName == "Pending");
            var resolvedTickets = await ticketsQuery.CountAsync(t => t.Status.StatusName == "Resolved");
            var criticalTickets = await ticketsQuery.CountAsync(t =>
                t.Priority.Name == "Critical" &&
                t.Status.StatusName != "Resolved" &&
                t.Status.StatusName != "Closed" &&
                t.Status.StatusName != "Cancelled");

            var recentTickets = await ticketsQuery
                .OrderByDescending(t => t.CreatedAt)
                .Take(10)
                .Select(t => new
                {
                    t.Id,
                    t.TicketNumber,
                    t.Subject,
                    Status = t.Status.StatusName,
                    Priority = t.Priority.Name,
                    Category = t.Category.Name,
                    t.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                OpenTickets = openTickets,
                PendingTickets = pendingTickets,
                ResolvedTickets = resolvedTickets,
                CriticalTickets = criticalTickets,
                RecentTickets = recentTickets
            });
        }

        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAdminDashboard()
        {
            var usersQuery = _context.Users.AsNoTracking();
            var ticketsQuery = _context.Tickets.AsNoTracking().Where(t => !t.IsDeleted);

            var totalUsers = await usersQuery.CountAsync();
            var supportAgents = await usersQuery.CountAsync(u =>
                u.Role != null &&
                (u.Role.Name == "IT Support Agent" || u.Role.Name == "Agent" || u.Role.Name == "IT"));

            var totalTickets = await ticketsQuery.CountAsync();
            var activeTickets = await ticketsQuery.CountAsync(t =>
                t.Status.StatusName == "Open" ||
                t.Status.StatusName == "In Progress" ||
                t.Status.StatusName == "Pending" ||
                t.Status.StatusName == "Reopened");

            var resolvedTickets = await ticketsQuery.CountAsync(t =>
                t.Status.StatusName == "Resolved" ||
                t.Status.StatusName == "Closed");

            var criticalTickets = await ticketsQuery.CountAsync(t =>
                t.Priority.Name == "Critical" &&
                t.Status.StatusName != "Resolved" &&
                t.Status.StatusName != "Closed" &&
                t.Status.StatusName != "Cancelled");

            var unassignedTickets = await ticketsQuery.CountAsync(t =>
                t.AssignedToUserId == null &&
                t.Status.StatusName != "Resolved" &&
                t.Status.StatusName != "Closed" &&
                t.Status.StatusName != "Cancelled");

            var ticketsByStatus = await ticketsQuery
                .GroupBy(t => t.Status.StatusName)
                .Select(group => new { Name = group.Key, Count = group.Count() })
                .OrderByDescending(item => item.Count)
                .ToListAsync();

            var ticketsByPriority = await ticketsQuery
                .GroupBy(t => t.Priority.Name)
                .Select(group => new { Name = group.Key, Count = group.Count() })
                .OrderByDescending(item => item.Count)
                .ToListAsync();

            var ticketsByCategory = await ticketsQuery
                .GroupBy(t => t.Category.Name)
                .Select(group => new { Name = group.Key, Count = group.Count() })
                .OrderByDescending(item => item.Count)
                .ToListAsync();

            var usersByRole = await usersQuery
                .GroupBy(u => u.Role != null ? u.Role.Name : "No Role")
                .Select(group => new { Name = group.Key, Count = group.Count() })
                .OrderByDescending(item => item.Count)
                .ToListAsync();

            var recentActivity = await ticketsQuery
                .OrderByDescending(t => t.CreatedAt)
                .Take(10)
                .Select(t => new
                {
                    User = t.CreatedByUser.FullName,
                    Role = t.CreatedByUser.Role != null ? t.CreatedByUser.Role.Name : "No Role",
                    Action = "Created ticket",
                    Target = t.TicketNumber,
                    t.Subject,
                    Status = t.Status.StatusName,
                    Priority = t.Priority.Name,
                    Date = t.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                TotalUsers = totalUsers,
                SupportAgents = supportAgents,
                TotalTickets = totalTickets,
                ActiveTickets = activeTickets,
                ResolvedTickets = resolvedTickets,
                CriticalTickets = criticalTickets,
                UnassignedTickets = unassignedTickets,
                TicketsByStatus = ticketsByStatus,
                TicketsByPriority = ticketsByPriority,
                TicketsByCategory = ticketsByCategory,
                UsersByRole = usersByRole,
                RecentActivity = recentActivity
            });
        }

        [HttpGet("admin/resolved-last-30-days")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAdminResolvedLast30Days()
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

        [HttpGet("agent")]
        [Authorize(Roles = "IT Support Agent,Agent")]
        public async Task<IActionResult> GetAgentDashboard()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { message = "Invalid or missing user ID in token." });

            var activeAssignedTickets = _context.Tickets
                .AsNoTracking()
                .Where(t =>
                    !t.IsDeleted &&
                    t.AssignedToUserId == userId &&
                    t.Status.StatusName != "Resolved" &&
                    t.Status.StatusName != "Closed" &&
                    t.Status.StatusName != "Cancelled");

            var assignedToMe = await activeAssignedTickets.CountAsync();

            var unassignedTickets = await _context.Tickets
                .AsNoTracking()
                .CountAsync(t =>
                    !t.IsDeleted &&
                    t.AssignedToUserId == null &&
                    t.Status.StatusName != "Resolved" &&
                    t.Status.StatusName != "Closed" &&
                    t.Status.StatusName != "Cancelled");

            var criticalTickets = await activeAssignedTickets
                .CountAsync(t => t.Priority.Name == "Critical");

            var resolvedToday = await _context.Tickets
                .AsNoTracking()
                .CountAsync(t =>
                    !t.IsDeleted &&
                    t.AssignedToUserId == userId &&
                    t.Status.StatusName == "Resolved" &&
                    t.UpdatedAt.HasValue &&
                    t.UpdatedAt.Value.Date == DateTime.UtcNow.Date);

            var recentTickets = await activeAssignedTickets
                .OrderByDescending(t => t.CreatedAt)
                .Take(10)
                .Select(t => new
                {
                    id = t.Id,
                    ticketNumber = t.TicketNumber,
                    employee = t.CreatedByUser.FullName,
                    subject = t.Subject,
                    category = t.Category.Name,
                    status = t.Status.StatusName,
                    priority = t.Priority.Name,
                    createdAt = t.CreatedAt
                })
                .ToListAsync();

            var availableTickets = await _context.Tickets
                .AsNoTracking()
                .Where(t =>
                    !t.IsDeleted &&
                    t.AssignedToUserId == null &&
                    t.Status.StatusName != "Resolved" &&
                    t.Status.StatusName != "Closed" &&
                    t.Status.StatusName != "Cancelled")
                .OrderByDescending(t => t.Priority.Name == "Critical")
                .ThenBy(t => t.CreatedAt)
                .Take(10)
                .Select(t => new
                {
                    id = t.Id,
                    ticketNumber = t.TicketNumber,
                    employee = t.CreatedByUser.FullName,
                    subject = t.Subject,
                    category = t.Category.Name,
                    status = t.Status.StatusName,
                    priority = t.Priority.Name,
                    createdAt = t.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                assignedToMe,
                unassignedTickets,
                criticalTickets,
                resolvedToday,
                recentTickets,
                availableTickets
            });
        }

        [HttpGet("manager")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> GetManagerDashboard()
        {
            var ticketsQuery = _context.Tickets.AsNoTracking().Where(t => !t.IsDeleted);
            var supportAgentsQuery = _context.Users
                .AsNoTracking()
                .Where(u => u.Role != null &&
                    (u.Role.Name == "IT Support Agent" ||
                     u.Role.Name == "Agent" ||
                     u.Role.Name == "IT"));

            var teamTickets = await ticketsQuery.CountAsync();
            var openTickets = await ticketsQuery.CountAsync(t =>
                t.Status.StatusName == "Open" ||
                t.Status.StatusName == "In Progress" ||
                t.Status.StatusName == "Pending" ||
                t.Status.StatusName == "Reopened");

            var overdueTickets = await ticketsQuery.CountAsync(t =>
                (t.Status.StatusName == "Open" ||
                 t.Status.StatusName == "In Progress" ||
                 t.Status.StatusName == "Pending" ||
                 t.Status.StatusName == "Reopened") &&
                t.CreatedAt < DateTime.UtcNow.AddDays(-3));

            var resolvedTickets = await ticketsQuery.CountAsync(t =>
                t.Status.StatusName == "Resolved" ||
                t.Status.StatusName == "Closed");

            var unassignedTickets = await ticketsQuery.CountAsync(t =>
                t.AssignedToUserId == null &&
                t.Status.StatusName != "Resolved" &&
                t.Status.StatusName != "Closed" &&
                t.Status.StatusName != "Cancelled");

            var criticalTickets = await ticketsQuery.CountAsync(t =>
                t.Priority.Name == "Critical" &&
                t.Status.StatusName != "Resolved" &&
                t.Status.StatusName != "Closed" &&
                t.Status.StatusName != "Cancelled");

            var supportAgents = await supportAgentsQuery
                .Select(agent => new { agent.ID, agent.FullName })
                .ToListAsync();

            var resolutionDurations = await ticketsQuery
                .Where(t =>
                    (t.Status.StatusName == "Resolved" || t.Status.StatusName == "Closed") &&
                    (t.ResolvedAt.HasValue || t.ClosedAt.HasValue))
                .Select(t => EF.Functions.DateDiffMinute(t.CreatedAt, t.ResolvedAt ?? t.ClosedAt!.Value))
                .Where(minutes => minutes >= 0)
                .ToListAsync();

            var averageResolutionTime = resolutionDurations.Count == 0
                ? 0
                : Math.Round(resolutionDurations.Average() / 60.0, 1);

            var ticketsByStatus = await ticketsQuery
                .GroupBy(t => t.Status.StatusName)
                .Select(group => new { Name = group.Key, Count = group.Count() })
                .OrderByDescending(item => item.Count)
                .ToListAsync();

            var recentTickets = await ticketsQuery
                .OrderByDescending(t => t.CreatedAt)
                .Take(10)
                .Select(t => new
                {
                    t.Id,
                    t.TicketNumber,
                    t.Subject,
                    Employee = t.CreatedByUser.FullName,
                    AssignedTo = t.AssignedToUser != null ? t.AssignedToUser.FullName : "Unassigned",
                    Status = t.Status.StatusName,
                    Priority = t.Priority.Name,
                    Category = t.Category.Name,
                    t.CreatedAt
                })
                .ToListAsync();

            var agentPerformance = new List<object>();

            foreach (var agent in supportAgents)
            {
                var assigned = await ticketsQuery.CountAsync(t => t.AssignedToUserId == agent.ID);
                var resolved = await ticketsQuery.CountAsync(t =>
                    t.AssignedToUserId == agent.ID &&
                    (t.Status.StatusName == "Resolved" || t.Status.StatusName == "Closed"));
                var open = await ticketsQuery.CountAsync(t =>
                    t.AssignedToUserId == agent.ID &&
                    (t.Status.StatusName == "Open" ||
                     t.Status.StatusName == "In Progress" ||
                     t.Status.StatusName == "Pending" ||
                     t.Status.StatusName == "Reopened"));

                var agentDurations = await ticketsQuery
                    .Where(t =>
                        t.AssignedToUserId == agent.ID &&
                        (t.Status.StatusName == "Resolved" || t.Status.StatusName == "Closed") &&
                        (t.ResolvedAt.HasValue || t.ClosedAt.HasValue))
                    .Select(t => EF.Functions.DateDiffMinute(t.CreatedAt, t.ResolvedAt ?? t.ClosedAt!.Value))
                    .Where(minutes => minutes >= 0)
                    .ToListAsync();

                var averageResolutionHours = agentDurations.Count == 0
                    ? 0
                    : agentDurations.Average() / 60.0;

                var resolutionRate = assigned == 0
                    ? 0
                    : (double)resolved / assigned * 100;

                agentPerformance.Add(new
                {
                    Agent = agent.FullName,
                    Assigned = assigned,
                    Resolved = resolved,
                    Open = open,
                    AverageResolutionTime = Math.Round(averageResolutionHours, 1),
                    ResolutionRate = Math.Round(resolutionRate, 0)
                });
            }

            return Ok(new
            {
                TeamTickets = teamTickets,
                OpenTickets = openTickets,
                OverdueTickets = overdueTickets,
                ResolvedTickets = resolvedTickets,
                UnassignedTickets = unassignedTickets,
                CriticalTickets = criticalTickets,
                SupportAgents = supportAgents.Count,
                AverageResolutionTime = averageResolutionTime,
                TicketsByStatus = ticketsByStatus,
                RecentTickets = recentTickets,
                AgentPerformance = agentPerformance
            });
        }
    }
}
