using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;
    public DashboardController(AppDbContext context) => _context = context;

    private static readonly string[] ActiveStatuses = { "Open", "New", "Assigned", "In Progress", "Pending", "Reopened" };

    [HttpGet("employee")]
    [Authorize(Roles = "Employee")]
    public async Task<IActionResult> Employee()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var q = _context.Tickets.AsNoTracking().Where(t => t.CreatedByUserId == userId && !t.IsDeleted);
        var recent = await q.OrderByDescending(t=>t.CreatedAt).Take(10).Select(t=>new { t.Id,t.TicketNumber,t.Subject,status=t.Status.StatusName,priority=t.Priority.Name,category=t.Category.Name,t.CreatedAt }).ToListAsync();
        return Ok(new {
            openTickets = await q.CountAsync(t=>ActiveStatuses.Contains(t.Status.StatusName)),
            pendingTickets = await q.CountAsync(t=>t.Status.StatusName=="Pending"),
            resolvedTickets = await q.CountAsync(t=>t.Status.StatusName=="Resolved"||t.Status.StatusName=="Closed"),
            criticalTickets = await q.CountAsync(t=>t.Priority.Name=="Critical"&&!new[]{"Resolved","Closed","Cancelled"}.Contains(t.Status.StatusName)),
            recentTickets = recent
        });
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Admin()
    {
        var users=_context.Users.AsNoTracking(); var q=_context.Tickets.AsNoTracking().Where(t=>!t.IsDeleted);
        return Ok(new {
            totalUsers=await users.CountAsync(),
            supportAgents=await users.CountAsync(u=>u.Role!=null&&(u.Role.Name=="Agent"||u.Role.Name=="IT Support Agent"||u.Role.Name=="IT")),
            totalTickets=await q.CountAsync(),
            activeTickets=await q.CountAsync(t=>ActiveStatuses.Contains(t.Status.StatusName)),
            resolvedTickets=await q.CountAsync(t=>t.Status.StatusName=="Resolved"||t.Status.StatusName=="Closed"),
            criticalTickets=await q.CountAsync(t=>t.Priority.Name=="Critical"&&!new[]{"Resolved","Closed","Cancelled"}.Contains(t.Status.StatusName)),
            unassignedTickets=await q.CountAsync(t=>t.AssignedToUserId==null&&!new[]{"Resolved","Closed","Cancelled"}.Contains(t.Status.StatusName)),
            ticketsByStatus=await q.GroupBy(t=>t.Status.StatusName).Select(g=>new{Name=g.Key,Count=g.Count()}).OrderByDescending(x=>x.Count).ToListAsync(),
            ticketsByPriority=await q.GroupBy(t=>t.Priority.Name).Select(g=>new{Name=g.Key,Count=g.Count()}).OrderByDescending(x=>x.Count).ToListAsync(),
            ticketsByCategory=await q.GroupBy(t=>t.Category.Name).Select(g=>new{Name=g.Key,Count=g.Count()}).OrderByDescending(x=>x.Count).ToListAsync(),
            usersByRole=await users.GroupBy(u=>u.Role!=null?u.Role.Name:"No Role").Select(g=>new{Name=g.Key,Count=g.Count()}).OrderByDescending(x=>x.Count).ToListAsync(),
            recentActivity=await q.OrderByDescending(t=>t.UpdatedAt??t.CreatedAt).Take(10).Select(t=>new{User=t.CreatedByUser.FullName,Role=t.CreatedByUser.Role!=null?t.CreatedByUser.Role.Name:"No Role",Action="Ticket activity",Target=t.TicketNumber,t.Subject,Status=t.Status.StatusName,Priority=t.Priority.Name,Date=t.UpdatedAt??t.CreatedAt}).ToListAsync()
        });
    }

    [HttpGet("admin/resolved-last-30-days")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResolvedLast30Days()
    {
        var start=DateTime.UtcNow.Date.AddDays(-29);
        var dates=await _context.Tickets.AsNoTracking().Where(t=>!t.IsDeleted&&(t.Status.StatusName=="Resolved"||t.Status.StatusName=="Closed")&&(t.ResolvedAt.HasValue||t.ClosedAt.HasValue||t.UpdatedAt.HasValue)).Select(t=>t.ResolvedAt??t.ClosedAt??t.UpdatedAt).Where(v=>v.HasValue&&v.Value>=start).Select(v=>v!.Value.Date).ToListAsync();
        var grouped=dates.GroupBy(d=>d).ToDictionary(g=>g.Key,g=>g.Count());
        var points=Enumerable.Range(0,30).Select(i=>start.AddDays(i)).Select(d=>new{date=d,label=d.ToString("MMM d"),count=grouped.TryGetValue(d,out var c)?c:0}).ToList();
        return Ok(new{total=points.Sum(p=>p.count),from=start,to=DateTime.UtcNow.Date,points});
    }

    [HttpGet("agent")]
    [Authorize(Roles = "IT Support Agent,Agent")]
    public async Task<IActionResult> Agent()
    {
        if(!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var userId)) return Unauthorized(new{message="Invalid user."});
        var mine=_context.Tickets.AsNoTracking().Where(t=>!t.IsDeleted&&t.AssignedToUserId==userId);
        var active=mine.Where(t=>!new[]{"Resolved","Closed","Cancelled"}.Contains(t.Status.StatusName));
        var recent=await mine.Where(t=>t.Status.StatusName!="Closed"&&t.Status.StatusName!="Cancelled").OrderByDescending(t=>t.UpdatedAt??t.CreatedAt).Take(15).Select(t=>new{id=t.Id,ticketNumber=t.TicketNumber,employee=t.CreatedByUser.FullName,subject=t.Subject,category=t.Category.Name,status=t.Status.StatusName,priority=t.Priority.Name,createdAt=t.CreatedAt,updatedAt=t.UpdatedAt}).ToListAsync();
        var available=await _context.Tickets.AsNoTracking().Where(t=>!t.IsDeleted&&t.AssignedToUserId==null&&(t.Status.StatusName=="Open"||t.Status.StatusName=="New"||t.Status.StatusName=="Reopened")).OrderByDescending(t=>t.Priority.Name=="Critical").ThenBy(t=>t.CreatedAt).Take(10).Select(t=>new{id=t.Id,ticketNumber=t.TicketNumber,employee=t.CreatedByUser.FullName,subject=t.Subject,category=t.Category.Name,status=t.Status.StatusName,priority=t.Priority.Name,createdAt=t.CreatedAt}).ToListAsync();
        return Ok(new{
            assignedToMe=await active.CountAsync(),
            unassignedTickets=await _context.Tickets.CountAsync(t=>!t.IsDeleted&&t.AssignedToUserId==null&&!new[]{"Resolved","Closed","Cancelled"}.Contains(t.Status.StatusName)),
            criticalTickets=await active.CountAsync(t=>t.Priority.Name=="Critical"),
            resolvedToday=await mine.CountAsync(t=>t.Status.StatusName=="Resolved"&&t.UpdatedAt.HasValue&&t.UpdatedAt.Value.Date==DateTime.UtcNow.Date),
            recentTickets=recent,availableTickets=available
        });
    }

    [HttpGet("manager")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Manager()
    {
        var q=_context.Tickets.AsNoTracking().Where(t=>!t.IsDeleted);
        var agents=_context.Users.AsNoTracking().Where(u=>u.Role!=null&&(u.Role.Name=="Agent"||u.Role.Name=="IT Support Agent"||u.Role.Name=="IT"));
        var recent=await q.OrderByDescending(t=>t.UpdatedAt??t.CreatedAt).Take(10).Select(t=>new{t.Id,t.TicketNumber,t.Subject,Employee=t.CreatedByUser.FullName,AssignedTo=t.AssignedToUser!=null?t.AssignedToUser.FullName:"Unassigned",Status=t.Status.StatusName,Priority=t.Priority.Name,Category=t.Category.Name,t.CreatedAt}).ToListAsync();
        var performance=await agents.Select(a=>new{Agent=a.FullName,Assigned=q.Count(t=>t.AssignedToUserId==a.ID),Resolved=q.Count(t=>t.AssignedToUserId==a.ID&&(t.Status.StatusName=="Resolved"||t.Status.StatusName=="Closed")),Open=q.Count(t=>t.AssignedToUserId==a.ID&&ActiveStatuses.Contains(t.Status.StatusName)),AverageResolutionTime=0.0,ResolutionRate=0.0}).ToListAsync();
        return Ok(new{
            teamTickets=await q.CountAsync(),openTickets=await q.CountAsync(t=>ActiveStatuses.Contains(t.Status.StatusName)),overdueTickets=await q.CountAsync(t=>ActiveStatuses.Contains(t.Status.StatusName)&&t.CreatedAt<DateTime.UtcNow.AddDays(-3)),resolvedTickets=await q.CountAsync(t=>t.Status.StatusName=="Resolved"||t.Status.StatusName=="Closed"),unassignedTickets=await q.CountAsync(t=>t.AssignedToUserId==null&&!new[]{"Resolved","Closed","Cancelled"}.Contains(t.Status.StatusName)),criticalTickets=await q.CountAsync(t=>t.Priority.Name=="Critical"&&!new[]{"Resolved","Closed","Cancelled"}.Contains(t.Status.StatusName)),supportAgents=await agents.CountAsync(),averageResolutionTime=0,ticketsByStatus=await q.GroupBy(t=>t.Status.StatusName).Select(g=>new{Name=g.Key,Count=g.Count()}).OrderByDescending(x=>x.Count).ToListAsync(),recentTickets=recent,agentPerformance=performance
        });
    }
}
