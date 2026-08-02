using backend.Data;
using backend.DTOs.Tickets;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;





namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    

    public class TicketsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TicketsController(AppDbContext context)
        {
            _context = context;
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

            return Ok(new
            {
                categories,
                priorities
            });
        }

       
        [HttpPost("create-ticket")]
        [Authorize(Roles = "Employee")]
        public async Task<IActionResult> CreateTicket(
            [FromBody] CreateTicketRequest request)
        {
            var categoryName = request.Category.Trim().ToLower();

            var category = await _context.Categories
                .FirstOrDefaultAsync(c =>
                    c.IsActive &&
                    c.Name.ToLower() == categoryName);

            if (category == null)
            {
                return BadRequest(new
                {
                    message = "Invalid ticket category."
                });
            }

            var priorityName = request.Priority.Trim().ToLower();

            var priority = await _context.Priorities
                .FirstOrDefaultAsync(p =>
                    p.Name.ToLower() == priorityName);

            if (priority == null)
            {
                return BadRequest(new
                {
                    message = "Invalid ticket priority."
                });
            }

            var openStatus = await _context.Statuses
                .FirstOrDefaultAsync(s =>
                    s.StatusName.ToLower() == "open");

            if (openStatus == null)
            {
                return BadRequest(new
                {
                    message = "The Open ticket status was not found."
                });
            }

            var userIdValue = User.FindFirstValue(
                ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userIdValue) ||
                !int.TryParse(userIdValue, out var userId))
            {
                return Unauthorized(new
                {
                    message = "Invalid or missing user ID in token."
                });
            }

            var ticket = new Ticket
            {
                TicketNumber =
                    $"TKT-{Guid.NewGuid().ToString()[..8].ToUpper()}",
                Subject = request.Subject.Trim(),
                Description = request.Description.Trim(),
                CategoryId = category.ID,
                PriorityId = priority.ID,
                StatusId = openStatus.ID,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = userId
            };

            _context.Tickets.Add(ticket);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetTicketById),
                new { id = ticket.Id },
                new
                {
                    message = "Ticket created successfully.",
                    ticketId = ticket.Id,
                    ticketNumber = ticket.TicketNumber
                }
            );
        }

[HttpGet("{id}")]
public async Task<IActionResult> GetTicketById(int id)
{
    var userIdValue = User.FindFirstValue(
        ClaimTypes.NameIdentifier
    );

    var userRole = User.FindFirstValue(
        ClaimTypes.Role
    );

    if (!int.TryParse(userIdValue, out var userId))
    {
        return Unauthorized(new
        {
            message = "Invalid or missing user ID in token."
        });
    }

    var ticketQuery = _context.Tickets
        .Where(t => t.Id == id && !t.IsDeleted);

    if (userRole == "Employee")
    {
        ticketQuery = ticketQuery.Where(
            t => t.CreatedByUserId == userId
        );
    }

    var ticket = await ticketQuery
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
        .FirstOrDefaultAsync();

    if (ticket == null)
    {
        return NotFound(new
        {
            message = "Ticket not found or you do not have access."
        });
    }

    return Ok(ticket);
}

[HttpGet]
public async Task<IActionResult> GetTickets()
        {
            var tickets= await _context.Tickets
            .Where(t=>!t.IsDeleted)
            .OrderByDescending(t=>t.CreatedAt)
            .Select (t=> new TicketResponse
            {
                Id=t.Id,
                TicketNumber=t.TicketNumber,
                Subject=t.Subject,
                Description=t.Description,
                Category=t.Category.Name,
                Priority=t.Priority.Name,
                Status=t.Status.StatusName,
                CreatedAt=t.CreatedAt
            })
            .ToListAsync();
            return Ok(tickets);
        }

[HttpPut("{id}")]
public async Task<IActionResult> UpdateTicket
(int id, UpdateTicketRequest request)
{
var ticket = await _context.Tickets
.FirstOrDefaultAsync(t=>t.Id==id && !t.IsDeleted);

if(ticket==null)
            {
                return NotFound(new
                {
                    message="Ticket not found."
                });
            }

var categoryExists= await _context.Categories
.AnyAsync(c=>c.ID==request.CategoryId);

if(!categoryExists)
            {
                return BadRequest(new
                {
                    message="Invalid category."
                });
            }
var priorityExists= await _context.Priorities
.AnyAsync(p=>p.ID==request.PriorityId);

if(!priorityExists)
            {
                return BadRequest(new
                {
                    message="Invalid priority."
                });
            }
var statusExists= await _context.Statuses
.AnyAsync(s=>s.ID==request.StatusId);

if(!statusExists)
            {
                return BadRequest(new
                {
                    message="Invalid status."
                });
            }
if (request.AssignedToUserId.HasValue)
            {
              var assignedUserExists= await _context.Users
              .AnyAsync(u => u.ID == request.AssignedToUserId.Value);

              if(!assignedUserExists)
                {
                    return BadRequest(new
                    {
                        message="Assigned user not found."
                    });
                }
            }
            ticket.Subject= request.Subject;
            ticket.Description= request.Description;
            ticket.CategoryId= request.CategoryId;
            ticket.PriorityId= request.PriorityId;
            ticket.StatusId= request.StatusId;
            ticket.AssignedToUserId= request.AssignedToUserId;
            ticket.ResolutionNotes= request.ResolutionNotes;
            ticket.UpdatedAt= DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message="Ticket updated successfully."
            });


} 


[HttpDelete("{id}")]
[Authorize(Roles="Admin")]
public async Task<IActionResult> DeleteTicket(int id)
{
   var ticket= await _context.Tickets
   .FirstOrDefaultAsync(t=>t.Id==id &&!t.IsDeleted);

   if(ticket==null)
            {
                return NotFound(new
                {
                    message="Ticket not found."
                });
            }
            _context.Tickets.Remove(ticket);
            await _context.SaveChangesAsync();

            ticket.UpdatedAt= DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message="Ticket deleted successfully."
            });
}
[HttpGet("my-tickets")]
[Authorize(Roles="Employee")]
public async Task<IActionResult> GetMyTickets()
{
  var userIdValue= User.FindFirstValue(ClaimTypes.NameIdentifier);

  if(!int.TryParse(userIdValue, out var userId))
  {
    return Unauthorized(new
    {
        message="Invalid or missing user ID in token."
    });
  }
  var tickets= await _context.Tickets
  .Where(t=>
  t.CreatedByUserId==userId && !t.IsDeleted)
  .OrderByDescending(t=>t.CreatedAt)
    .Select(t=> new TicketResponse
    {
        Id=t.Id,
        TicketNumber=t.TicketNumber,
        Subject=t.Subject,
        Description=t.Description,
        Category=t.Category.Name,
        Priority=t.Priority.Name,
        Status=t.Status.StatusName,
        CreatedAt=t.CreatedAt
    })
    .ToListAsync();
    return Ok(tickets);

}
[HttpPost("{id}/comments")]
public async Task<IActionResult> AddComment(int id, AddTicketCommentRequest request)
        {
            var useIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if(!int.TryParse(useIdValue, out var userId))
            {
                return Unauthorized(new
                {
                    message = "Invalid or missing user ID in token."
                });
            }
            if (string.IsNullOrWhiteSpace(request.Comment))
            {
                return BadRequest(new
                {
                    message = "Comment cannot be empty."
                });
            }
            var ticket = await _context.Tickets
                .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
                if (ticket == null)
                {
                    return NotFound(new
                    {
                        message = "Ticket not found."
                    });
                }
                if (userRole == "Employee" && ticket.CreatedByUserId != userId)
                {
                    return Forbid();
                   
                }
                var comment= new TicketComment
                {
                    Comment = request.Comment.Trim(),
                    CreatedAt = DateTime.UtcNow,
                    TicketID = ticket.Id,
                    UserID = userId

                };
                _context.TicketComments.Add(comment);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Comment added successfully.",
                    comment= new
                    {
                        comment.ID,
                        comment.Comment,
                        comment.CreatedAt,
                        comment.UserID
                    }
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
            t.Status.StatusName != "Resolved" &&
            t.Status.StatusName != "Closed")
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
        .Where(u =>
            u.Role != null &&
            (u.Role.Name == "IT Support Agent" ||
             u.Role.Name == "Agent" ||
             u.Role.Name == "IT"))
        .Select(u => new
        {
            id = u.ID,
            name = u.FullName,
            activeTickets = _context.Tickets.Count(t =>
                t.AssignedToUserId == u.ID &&
                !t.IsDeleted &&
                t.Status.StatusName != "Resolved" &&
                t.Status.StatusName != "Closed")
        })
        .OrderBy(agent => agent.activeTickets)
        .ThenBy(agent => agent.name)
        .ToListAsync();

    return Ok(new
    {
        tickets,
        agents
    });
}

[HttpPost("{id:int}/assign")]
[Authorize(Roles="Manager,Agent")]
public async Task<IActionResult> AssignTicket(int id, AssignTicketRequest request)
        {
            var assignedByValue= User.FindFirstValue(ClaimTypes.NameIdentifier);

            if(!int.TryParse(assignedByValue, out var assignedByUserId))
            {
                return Unauthorized(new
                {
                    message="Invalid or missing user ID in token."
                });


            }

            var ticket= await _context.Tickets
            .Include(t=>t.Status)
            .Include(t=>t.AssignedToUser)
            .Include(t=>t.Assignments)
            .Include(t=>t.WorkSessions)
            .FirstOrDefaultAsync(t=>t.Id==id && !t.IsDeleted);

            if(ticket==null)
            {
                return NotFound(new
                {
                    message="Ticket not found."
                });
            }
            if(ticket.Status.StatusName.Equals("Closed",StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message="Cannot assign a closed ticket."
                });

            }
            var agent= await _context.Users
            .Include(u=>u.Role)
            .FirstOrDefaultAsync(u=>u.ID==request.AgentUserId);
            if (agent == null)
            {
                return BadRequest(new
                {
                    message = "Agent user not found."
                });
            }
            var agentRole = agent.Role?.Name.Trim().ToLowerInvariant()
                ?? string.Empty;

            if(agentRole != "it support agent" && agentRole !="agent" && agentRole!="it")
            {
                return BadRequest(new
                {
                    message="The assigned user is not an agent."
                });
            }
             var now = DateTime.UtcNow;
    var previousAgentName = ticket.AssignedToUser?.FullName;

    /*
     * End the previous assignment.
     */
    var currentAssignment = ticket.Assignments
        .FirstOrDefault(a => a.UnassignedAt == null);

    if (currentAssignment != null)
    {
        currentAssignment.UnassignedAt = now;
        currentAssignment.UnassignmentReason =
            $"Reassigned to {agent.FullName}.";
    }

    /*
     * Stop the previous agent's active timer.
     * Their completed working time is preserved.
     */
    foreach (var workSession in ticket.WorkSessions
                 .Where(session => session.EndedAt == null))
    {
        workSession.EndedAt = now;

        workSession.DurationMinutes = Math.Max(
            1,
            (int)Math.Ceiling(
                (now - workSession.StartAt).TotalMinutes
            )
        );

        workSession.StopReason = "Ticket reassigned.";
    }

    /*
     * Create the new assignment record.
     */
    var assignment = new TicketAssignment
    {
        TicketID = ticket.Id,
        AgentUserID = agent.ID,
        AssignedByUserID = assignedByUserId,
        AssignedAt = now
    };

    _context.TicketAssignments.Add(assignment);

    /*
     * Store the current agent directly on the ticket.
     */
    ticket.AssignedToUserId = agent.ID;
    ticket.UpdatedAt = now;

    /*
     * Add permanent audit history.
     */
    _context.TicketHistories.Add(new TicketHistory
    {
        TicketID = ticket.Id,
        ChangedByUserID = assignedByUserId,
        Action = previousAgentName == null
            ? "Ticket assigned"
            : "Ticket reassigned",
        OldValue = previousAgentName,
        NewValue = agent.FullName,
        CreatedAt = now
    });

    /*
     * Add the readable activity timeline entry.
     */
    _context.TicketActivityLogs.Add(new TicketActivityLog
    {
        TicketID = ticket.Id,
        PerformedByUserID = assignedByUserId,
        ActivityType = previousAgentName == null
            ? "Assigned"
            : "Reassigned",
        Description = previousAgentName == null
            ? $"Ticket assigned to {agent.FullName}."
            : $"Ticket reassigned from {previousAgentName} to {agent.FullName}.",
        CreatedAt = now
    });

    try
    {
        await _context.SaveChangesAsync();
    }
    catch (DbUpdateException)
    {
        return Conflict(new
        {
            message =
                "The ticket assignment changed. Refresh and try again."
        });
    }

    return Ok(new
    {
        message = $"Ticket assigned to {agent.FullName}.",
        assignedAgent = new
        {
            id = agent.ID,
            name = agent.FullName
        }
    });
}
            
            }


        }


