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
    if (request == null)
    {
        return BadRequest(new
        {
            message = "Ticket information is required."
        });
    }

    if (string.IsNullOrWhiteSpace(request.Subject))
    {
        return BadRequest(new
        {
            message = "Subject is required."
        });
    }

    if (string.IsNullOrWhiteSpace(request.Description))
    {
        return BadRequest(new
        {
            message = "Description is required."
        });
    }

    if (string.IsNullOrWhiteSpace(request.Category))
    {
        return BadRequest(new
        {
            message = "Category is required."
        });
    }

    if (string.IsNullOrWhiteSpace(request.Priority))
    {
        return BadRequest(new
        {
            message = "Priority is required."
        });
    }

    var categoryName = request.Category.Trim();

    var category = await _context.Categories
        .FirstOrDefaultAsync(c =>
            c.IsActive &&
            c.Name.ToLower() == categoryName.ToLower());

    if (category == null)
    {
        return BadRequest(new
        {
            message = "Invalid ticket category."
        });
    }

    var priorityName = request.Priority.Trim();

    var priority = await _context.Priorities
        .FirstOrDefaultAsync(p =>
            p.Name.ToLower() == priorityName.ToLower());

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

    if (string.IsNullOrWhiteSpace(userIdValue) ||
        !int.TryParse(userIdValue, out var userId))
    {
        return Unauthorized(new
        {
            message = "Invalid or missing user ID in token."
        });
    }

    var employeeExists = await _context.Users
        .AnyAsync(u => u.ID == userId);

    if (!employeeExists)
    {
        return Unauthorized(new
        {
            message = "The authenticated user was not found."
        });
    }

    var ticket = new Ticket
    {
        TicketNumber =
            $"TKT-{Guid.NewGuid().ToString("N")[..8].ToUpper()}",
        Subject = request.Subject.Trim(),
        Description = request.Description.Trim(),
        CategoryId = category.ID,
        PriorityId = priority.ID,
        StatusId = openStatus.ID,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        CreatedByUserId = userId,
        IsDeleted = false
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

[HttpGet("{id:int}")]
[Authorize]
public async Task<IActionResult> GetTicketById(int id)
{
    var userIdValue = User.FindFirstValue(
        ClaimTypes.NameIdentifier
    );

    var userRole = User.FindFirstValue(
        ClaimTypes.Role
    );

    if (string.IsNullOrWhiteSpace(userIdValue) ||
        !int.TryParse(userIdValue, out var userId))
    {
        return Unauthorized(new
        {
            message = "Invalid or missing user ID in token."
        });
    }

    var ticketQuery = _context.Tickets
        .AsNoTracking()
        .Where(t =>
            t.Id == id &&
            !t.IsDeleted);

    if (userRole == "Employee")
    {
        ticketQuery = ticketQuery.Where(
            t => t.CreatedByUserId == userId
        );
    }
    else if (userRole == "IT Support Agent")
    {
        ticketQuery = ticketQuery.Where(
            t => t.AssignedToUserId == userId
        );
    }
    else if (userRole != "Manager" &&
             userRole != "Admin")
    {
        return Forbid();
    }

    var ticket = await ticketQuery
        .Select(t => new
        {
            id = t.Id,
            ticketNumber = t.TicketNumber,
            subject = t.Subject,
            description = t.Description,
            category = t.Category.Name,
            priority = t.Priority.Name,
            status = t.Status.StatusName,
            createdAt = t.CreatedAt,
            updatedAt = t.UpdatedAt,
            closedAt = t.ClosedAt,

            employee = new
            {
                id = t.CreatedByUser.ID,
                name = t.CreatedByUser.FullName,
                email = t.CreatedByUser.Email
            },

            assignedAgent = t.AssignedToUserId == null
                ? null
                : new
                {
                    id = t.AssignedToUser.ID,
                    name = t.AssignedToUser.FullName,
                    email = t.AssignedToUser.Email
                },

            activeWorkSession = _context.TicketWorkSessions
                .Where(session =>
                    session.TicketID == t.Id &&
                    session.AgentUserID == userId &&
                    session.EndedAt == null)
                .Select(session => new
                {
                    id = session.ID,
                    startedAt = session.StartAt
                })
                .FirstOrDefault(),

            totalWorkMinutes = _context.TicketWorkSessions
                .Where(session =>
                    session.TicketID == t.Id &&
                    session.EndedAt != null)
                .Sum(session =>
                    session.DurationMinutes ?? 0),

            isClosed =
                t.Status.StatusName.ToLower() == "closed",

            canEdit =
                t.Status.StatusName.ToLower() != "closed"
        })
        .FirstOrDefaultAsync();

    if (ticket == null)
    {
        return NotFound(new
        {
            message =
                "Ticket not found or you do not have access."
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

[HttpPost("{id:int}/assign")]
[Authorize(Roles="Manager")]
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
            var agentRole= await _context.Roles
                .Where(r => r.ID == agent.RoleID)
                .Select(r => r.Name.Trim().ToLower())
                .FirstOrDefaultAsync();

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
    var currentAssignment = await _context.TicketAssignments
        .FirstOrDefaultAsync(a =>
            a.TicketID == ticket.Id &&
            a.UnassignedAt == null);

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
var activeWorkSessions = await _context.TicketWorkSessions
    .Where(session =>
        session.TicketID == ticket.Id &&
        session.EndedAt == null)
    .ToListAsync();

foreach (var workSession in activeWorkSessions)
{
    workSession.EndedAt = now;
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


[HttpGet("assignment-options")]
[Authorize(Roles="Manager")]
public async Task<IActionResult> GetAssignmentOptions()
        {
            var tickets= await _context.Tickets
            .AsNoTracking()
            .Where(t=>
            !t.IsDeleted &&
            t.AssignedToUserId==null &&
            t.Status.StatusName!="Closed")
            .OrderBy(t=>t.CreatedAt)
            .Select(t=> new
            {
                id=t.Id,
                ticketNumber=t.TicketNumber,
                subject=t.Subject,
                category=t.Category.Name,
                priority=t.Priority.Name,
                status=t.Status.StatusName,
                createdAt=t.CreatedAt
            })
            .ToListAsync();

            var agents= await _context.Users
            .AsNoTracking()
            .Where(u=>u.Role.Name=="It Support Agent")
            .Select(u=> new
            {
                id=u.ID,
                name=u.FullName,

                activeTickets=_context.Tickets.Count(t=>
                t.AssignedToUserId==u.ID &&
                !t.IsDeleted &&
                t.Status.StatusName!="Closed" &&
                t.Status.StatusName!="Resolved")
            })
            .OrderBy(a=>a.activeTickets)
            .ThenBy(a=>a.name)
            .ToListAsync();
            return Ok(new
            {
                tickets,
                agents
            });
        }
            


              [HttpPost("{id:int}/take")]
        [Authorize(Roles="IT Support Agent")]
        public async Task<IActionResult> TakeTicket(int id){
            var userIdValue= User.FindFirstValue(ClaimTypes.NameIdentifier);
            if(string.IsNullOrWhiteSpace(userIdValue) ||
            !int.TryParse(userIdValue, out var agentUserId))
            {
                return Unauthorized(new
                {
                    message="Invalid or missing user ID in token."
                });
            }
            var ticket= await _context.Tickets
            .Include(t=>t.Status)
            .FirstOrDefaultAsync(t=>t.Id==id && !t.IsDeleted);

            if(ticket==null)
            {
                return NotFound(new
                {
                    message="Ticket not found."
                });
            }

            if(ticket.AssignedToUserId!=null)
            {
                return Conflict(new
                {
                    message="Ticket is already assigned."
                });
            }
            var statusName= ticket.Status.StatusName;

            if(statusName.Equals("Closed", StringComparison.OrdinalIgnoreCase)||
            statusName.Equals("Resolved", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message="Cannot take a closed or resolved ticket."
                });
            }

            var agent= await _context.Users
            .Include(u=>u.Role)
            .FirstOrDefaultAsync(u=>u.ID==agentUserId);

            if (agent == null)
            {
                return Unauthorized(new
                {
                    message="Agent user not found."
                });
            }

            if(!agent.Role.Name.Equals(
                "IT Support Agent", StringComparison.OrdinalIgnoreCase))
            {
                return Forbid();
            }
            var now= DateTime.UtcNow;
            ticket.AssignedToUserId=agentUserId;
            ticket.UpdatedAt=now;

            _context.TicketAssignments.Add(new TicketAssignment
            {
                TicketID=ticket.Id,
                AgentUserID=agentUserId,
                AssignedByUserID=agentUserId,
                AssignedAt=now 
            
            });

            _context.TicketHistories.Add(new TicketHistory
            {
                TicketID=ticket.Id,
                ChangedByUserID=agentUserId,
                Action="Ticket taken",
                OldValue=null,
                NewValue=agent.FullName,
                CreatedAt=now
            });
            _context.TicketActivityLogs.Add(new TicketActivityLog
            {
                TicketID=ticket.Id,
                PerformedByUserID=agentUserId,
                ActivityType="Taken",
                Description=$"{agent.FullName} took the ticket.",
                CreatedAt=now
            });

            try
            {
                await _context.SaveChangesAsync();
            }
            catch(DbUpdateException)
            {
                return Conflict(new
                {
                    message="The ticket assignment changed. Refresh and try again."
                });
            }
            return Ok(new
            {
                message="Ticket Taken successfully.",
                ticketId=ticket.Id,
                ticketNumber=ticket.TicketNumber,
            });
            

        }


        [HttpPost("{id:int}/start-work")]
        [Authorize(Roles="IT Support Agent")]
        public async Task<IActionResult> StartWork(int id)
        {
            var userIdValue= User.FindFirstValue(ClaimTypes.NameIdentifier);
            if(string.IsNullOrWhiteSpace(userIdValue) ||
            !int.TryParse(userIdValue, out var agentUserId))
            {
                return Unauthorized(new
                {
                    message="Invalid or missing user ID in token."
                });
            }
            var ticket= await _context.Tickets
            .Include(t=>t.Status)
            .FirstOrDefaultAsync(t=>t.Id==id && !t.IsDeleted && t.AssignedToUserId==agentUserId);

            if(ticket==null)
            {
                return NotFound(new
                {
                    message="Ticket not found or not assigned to you."
                });
            }
            if(ticket.Status.StatusName.Equals("Closed", StringComparison.OrdinalIgnoreCase)||
            ticket.Status.StatusName.Equals("Resolved", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message="Cannot start work on a closed or resolved ticket."
                });
            }
            var activeSession= await _context.TicketWorkSessions
            .FirstOrDefaultAsync(session=>
            session.AgentUserID==agentUserId &&
            session.EndedAt==null);
            if(activeSession!=null)
            {
                return Conflict(new
                {
                   message= activeSession.TicketID==ticket.Id
                   ?"You already have an active work session on this ticket."
                   :"YOU already have an active work session on a active ticket.",
                   activeTicketId=activeSession.TicketID
                });
            }
            var workSession= new TicketWorkSession
            {
                TicketID=ticket.Id,
                AgentUserID=agentUserId,
                StartAt=DateTime.UtcNow
            };
            _context.TicketWorkSessions.Add(workSession);
            ticket.UpdatedAt=DateTime.UtcNow;

            var inProgressStatus= await _context.Statuses
            .FirstOrDefaultAsync(status =>
            status.StatusName.ToLower()=="in progress");

            if(inProgressStatus!=null &&
            !ticket.Status.StatusName.Equals(
                "In Progress",StringComparison.OrdinalIgnoreCase
            ))
            {
                var previousStatus= ticket.Status.StatusName;

                _context.TicketHistories.Add(new TicketHistory
                {
                    TicketID=ticket.Id,
                    ChangedByUserID=agentUserId,
                    Action="Status changed",
                    OldValue=previousStatus,
                    NewValue="In Progress",
                    CreatedAt=DateTime.UtcNow
                });
            }

            _context
.TicketActivityLogs.Add(new TicketActivityLog
            {
                TicketID=ticket.Id,
                PerformedByUserID=agentUserId,
                ActivityType="Work Started",
                Description="work session started.",
                CreatedAt=DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new
            {
                message="Work session started.",
                sessionId=workSession.ID,
                startedAt= workSession.StartAt,
                status="In Progress"
            });
        }
  [HttpPost("{id:int}/pause-work")]
  public async Task<IActionResult> PauseWork(int id)
        {
            var userIdValue=User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userIdValue) ||
                !int.TryParse(userIdValue, out var agentUserId))
            {
                return Unauthorized(new
                {
                    message = "Invalid or missing user ID in token."
                });
            }
            var ticketExists = await _context.Tickets
                .AnyAsync(t => t.Id == id && !t.IsDeleted && t.AssignedToUserId == agentUserId);

                if(!ticketExists)
                {
                    return NotFound(new
                    {
                        message = "Ticket not found or not assigned to you."
                    });
                }
                var activeSession=await _context.TicketWorkSessions
                .FirstOrDefaultAsync(session=>
                session.TicketID==id &&
                    session.AgentUserID==agentUserId &&
                    session.EndedAt==null);

                    if(activeSession==null)
                    {
                        return BadRequest(new
                        {
                            message="No active work session found for this ticket."
                        });
                    }

                    var now=DateTime.UtcNow;
                    var duration= now -activeSession.StartAt;
                    activeSession.EndedAt=now;

                    activeSession.DurationMinutes=Math.Max(1,
                    (int)Math.Ceiling(duration.TotalMinutes));
                    activeSession.StopReason="Paused";
                    var ticket= await _context.Tickets
                    .FirstAsync(t=>t.Id==id);

                    ticket.UpdatedAt=now;

                    _context.TicketActivityLogs.Add(new TicketActivityLog
                    {
                        TicketID=id,
                        PerformedByUserID=agentUserId,
                        ActivityType="Work Paused",
                        Description=$"Work session paused after {activeSession.DurationMinutes} minutes.",
                        CreatedAt=now
                    });
                    await _context.SaveChangesAsync();
                    return Ok(new
                    {
                        message="Work session paused.",
                        sessionId=activeSession.ID,
                        endedAt=activeSession.EndedAt,
                        durationMinutes=activeSession.DurationMinutes,

                    });

        }
        
            }


        }

      




