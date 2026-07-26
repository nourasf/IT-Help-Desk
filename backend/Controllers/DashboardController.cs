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
public async Task<IActionResult> GetAdminDashboard()
        {
            var totalUsers = await _context.Users
            .CountAsync(u=>u.Role.Name =="IT Support Agent");

            var totalAgents = await _context.Users
            .CountAsync(u=>u.Role.Name =="IT Support Agent");

            var tickets = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.Priority)
            .Include(t => t.CreatedByUser)
              .ThenInclude(u => u.Role)
            .Where(t => !t.IsDeleted)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

            var result = new
            {
                TotalUsers = totalUsers,
                
                SupportAgents= totalAgents,
                TotalTickets = tickets.Count,
                CriticalTickets = tickets.Count(t => t.Priority.Name == "Critical"),

                RecentActivity= tickets.Take(5).Select(t=> new
                {
                    User= t.CreatedByUser.FullName,
                    Role =t.CreatedByUser.Role.Name,
                    Action= "Created Ticket",
                    Target= t.TicketNumber,
                    Date= t.CreatedAt
                })
            };
            return Ok(result);
            }

        [ HttpGet("agent")]
        public async Task<IActionResult> GetAgentDashboard()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if(string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized();
            }
            var userId = int.Parse(userIdClaim);

            var tickets = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.Priority)
            .Include(t => t.Category)
            .Include(t => t.CreatedByUser)
            .Where(t=>!t.IsDeleted)
            .OrderByDescending(t=>t.CreatedAt)
            .ToListAsync();

            var assignedTickets = tickets
            .Where(t => t.AssignedToUserId == userId)
            .ToList();

            var result= new
            {
                AssignedToMe= assignedTickets.Count,

                UnassignedTickets= tickets.Count(t=>t.AssignedToUserId==null),

                CriticalTickets= tickets.Count(t=>t.Priority.Name=="Critical" && t.Status.StatusName!="Resolved"),

                ResolvedToday= assignedTickets.Count(t=>
                t.Status.StatusName=="Resolved" &&
                t.UpdatedAt.HasValue &&
                t.UpdatedAt.Value.Date==DateTime.UtcNow.Date),

                RecentTickets= assignedTickets.Take(5).Select(t=> new
                {
                    t.Id,
                    t.TicketNumber,
                    Employee= t.CreatedByUser.FullName,
                    t.Subject,
                    Status= t.Status.StatusName,
                    Priority= t.Priority.Name,
                    t.CreatedAt
                })

            };
            return Ok(result);
        }

        [HttpGet("manager")]
        public async Task<IActionResult> GetManagerDashboard()
        {
            var tickets = await _context.Tickets
            .Include(t => t.Status)
            .Include(t => t.AssignedToUser)
            .Where(t => !t.IsDeleted)
            .ToListAsync();

            var supportAgents = await _context.Users
                .Include(u => u.Role)
                .Where(u => u.Role.Name == "IT Support Agent")
                .ToListAsync();


            var result = new
            {
                TeamTickets = tickets.Count,

                OpenTickets = tickets.Count(t=>
                t.Status.StatusName=="Open"||
                t.Status.StatusName=="In Progress"),

                OverdueTickets = tickets.Count(t=>
                t.Status.StatusName!="Resolved" &&
                t.CreatedAt < DateTime.UtcNow.AddDays(-3)),

                ResolvedTickets= tickets.Count(t=>
                t.Status.StatusName=="Resolved"),

                AgentPerformance= supportAgents.Select(agent=>
                {
                    var assignedTickets= tickets
                    .Where(t=>t.AssignedToUserId==agent.ID)
                    .ToList();

                    var resolvedTickets= assignedTickets
                    .Where(t=>t.Status.StatusName=="Resolved")
                    .ToList();

                    var averageResolutionHours= resolvedTickets.Any()
                    ? resolvedTickets
                    .Where(t=> t.UpdatedAt.HasValue)
                    .Select(t=>
                    (t.UpdatedAt!.Value - t.CreatedAt).TotalHours)
                    .DefaultIfEmpty(0)
                    .Average()
                    : 0;
                    return new
                    {
                        Agent= agent.FullName,
                        Assigned=assignedTickets.Count,
                        Resolved= resolvedTickets.Count,
                        Open= assignedTickets.Count(t=>
                        t.Status.StatusName != "Resolved"),
                        AverageResolutionTime= Math.Round(averageResolutionHours,1)

                    };
                })
            };
            return Ok(result);

           
        }

    }
}
