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

            var tickets = await _context.Tickets
                .Include(t => t.Status)
                .Include(t => t.Priority)
                .Include(t => t.Category)
                .Where(t => t.CreatedByUserId == userId && !t.IsDeleted)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            var result = new
            {
                OpenTickets = tickets.Count(t => t.Status.StatusName == "Open"),
                PendingTickets = tickets.Count(t => t.Status.StatusName == "Pending"),
                ResolvedTickets = tickets.Count(t => t.Status.StatusName == "Resolved"),
                CriticalTickets = tickets.Count(t => t.Status.StatusName == "Critical"),
                RecentTickets = tickets.Take(5).Select(t => new
                {
                    t.Id,
                    t.TicketNumber,
                    t.Subject,
                    Status = t.Status.StatusName,
                    Priority = t.Priority.Name,
                    Category = t.Category.Name,
                    t.CreatedAt
                })
            };

            return Ok(result);
        }

        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAdminDashboard()
        {
            var users = await _context.Users
                .Include(u => u.Role)
                .ToListAsync();

            var tickets = await _context.Tickets
                .Include(t => t.Status)
                .Include(t => t.Priority)
                .Include(t => t.Category)
                .Include(t => t.CreatedByUser)
                    .ThenInclude(u => u.Role)
                .Where(t => !t.IsDeleted)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            var result = new
            {
                TotalUsers = users.Count,
                SupportAgents = users.Count(u =>
                    u.Role != null &&
                    (u.Role.Name == "IT Support Agent" || u.Role.Name == "Agent")),
                TotalTickets = tickets.Count,
                ActiveTickets = tickets.Count(t =>
                    t.Status.StatusName == "Open" ||
                    t.Status.StatusName == "In Progress" ||
                    t.Status.StatusName == "Pending" ||
                    t.Status.StatusName == "Reopened"),
                ResolvedTickets = tickets.Count(t =>
                    t.Status.StatusName == "Resolved" ||
                    t.Status.StatusName == "Closed"),
                CriticalTickets = tickets.Count(t =>
                    t.Priority.Name == "Critical" &&
                    t.Status.StatusName != "Resolved" &&
                    t.Status.StatusName != "Closed" &&
                    t.Status.StatusName != "Cancelled"),
                UnassignedTickets = tickets.Count(t =>
                    t.AssignedToUserId == null &&
                    t.Status.StatusName != "Resolved" &&
                    t.Status.StatusName != "Closed" &&
                    t.Status.StatusName != "Cancelled"),

                TicketsByStatus = tickets
                    .GroupBy(t => t.Status.StatusName)
                    .Select(group => new { Name = group.Key, Count = group.Count() })
                    .OrderByDescending(item => item.Count),

                TicketsByPriority = tickets
                    .GroupBy(t => t.Priority.Name)
                    .Select(group => new { Name = group.Key, Count = group.Count() })
                    .OrderByDescending(item => item.Count),

                TicketsByCategory = tickets
                    .GroupBy(t => t.Category.Name)
                    .Select(group => new { Name = group.Key, Count = group.Count() })
                    .OrderByDescending(item => item.Count),

                UsersByRole = users
                    .GroupBy(u => u.Role?.Name ?? "No Role")
                    .Select(group => new { Name = group.Key, Count = group.Count() })
                    .OrderByDescending(item => item.Count),

                RecentActivity = tickets.Take(6).Select(t => new
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
            };

            return Ok(result);
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
                .Take(5)
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
            var tickets = await _context.Tickets
                .Include(t => t.Status)
                .Include(t => t.Priority)
                .Include(t => t.Category)
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .Where(t => !t.IsDeleted)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            var supportAgents = await _context.Users
                .Include(u => u.Role)
                .Where(u => u.Role != null &&
                    (u.Role.Name == "IT Support Agent" ||
                     u.Role.Name == "Agent" ||
                     u.Role.Name == "IT"))
                .ToListAsync();

            var activeTickets = tickets
                .Where(t =>
                    t.Status.StatusName == "Open" ||
                    t.Status.StatusName == "In Progress" ||
                    t.Status.StatusName == "Pending" ||
                    t.Status.StatusName == "Reopened")
                .ToList();

            var resolvedTickets = tickets
                .Where(t =>
                    t.Status.StatusName == "Resolved" ||
                    t.Status.StatusName == "Closed")
                .ToList();

            var resolutionDurations = resolvedTickets
                .Where(t => t.ClosedAt.HasValue || t.UpdatedAt.HasValue)
                .Select(t => ((t.ClosedAt ?? t.UpdatedAt)!.Value - t.CreatedAt).TotalHours)
                .Where(hours => hours >= 0)
                .ToList();

            var result = new
            {
                TeamTickets = tickets.Count,
                OpenTickets = activeTickets.Count,
                OverdueTickets = activeTickets.Count(t => t.CreatedAt < DateTime.UtcNow.AddDays(-3)),
                ResolvedTickets = resolvedTickets.Count,
                UnassignedTickets = activeTickets.Count(t => t.AssignedToUserId == null),
                CriticalTickets = activeTickets.Count(t => t.Priority.Name == "Critical"),
                SupportAgents = supportAgents.Count,
                AverageResolutionTime = resolutionDurations.Any()
                    ? Math.Round(resolutionDurations.Average(), 1)
                    : 0,

                TicketsByStatus = tickets
                    .GroupBy(t => t.Status.StatusName)
                    .Select(group => new { Name = group.Key, Count = group.Count() })
                    .OrderByDescending(item => item.Count),

                RecentTickets = tickets.Take(6).Select(t => new
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
                }),

                AgentPerformance = supportAgents.Select(agent =>
                {
                    var assignedTickets = tickets
                        .Where(t => t.AssignedToUserId == agent.ID)
                        .ToList();

                    var agentResolvedTickets = assignedTickets
                        .Where(t => t.Status.StatusName == "Resolved" || t.Status.StatusName == "Closed")
                        .ToList();

                    var agentResolutionDurations = agentResolvedTickets
                        .Where(t => t.ClosedAt.HasValue || t.UpdatedAt.HasValue)
                        .Select(t => ((t.ClosedAt ?? t.UpdatedAt)!.Value - t.CreatedAt).TotalHours)
                        .Where(hours => hours >= 0)
                        .ToList();

                    var averageResolutionHours = agentResolutionDurations.Any()
                        ? agentResolutionDurations.Average()
                        : 0;

                    var resolutionRate = assignedTickets.Any()
                        ? (double)agentResolvedTickets.Count / assignedTickets.Count * 100
                        : 0;

                    return new
                    {
                        Agent = agent.FullName,
                        Assigned = assignedTickets.Count,
                        Resolved = agentResolvedTickets.Count,
                        Open = assignedTickets.Count(t =>
                            t.Status.StatusName == "Open" ||
                            t.Status.StatusName == "In Progress" ||
                            t.Status.StatusName == "Pending" ||
                            t.Status.StatusName == "Reopened"),
                        AverageResolutionTime = Math.Round(averageResolutionHours, 1),
                        ResolutionRate = Math.Round(resolutionRate, 0)
                    };
                })
            };

            return Ok(result);
        }
    }
}
