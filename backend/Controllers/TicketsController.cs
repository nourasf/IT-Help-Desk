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

       
        [HttpPost("create-ticket")]
        [Authorize(Roles="Employee")]
        public async Task<IActionResult> CreateTicket(
            CreateTicketRequest request)
        {
            var categoryExists = await _context.Categories
            .AnyAsync(c=> c.ID==request.CategoryId);

            if(!categoryExists)
            {
                return BadRequest(new
                {
                    message= "invalid Category."
                });
            }

            var priorityExists= await _context.Priorities
            .AnyAsync(p=>p.ID== request.PriorityId);

            if(!priorityExists)
            {
                return BadRequest(new
                {
                    message="Invalid priority."
                });
            }
            var openStatus= await _context.Statuses
            .FirstOrDefaultAsync(s=>s.StatusName=="Open");

            if(openStatus==null)
            {
                return BadRequest(new
                {
                    message="Open status not found."
                });
            }

            var userIdValue= User.FindFirstValue(ClaimTypes.NameIdentifier);
            if(string.IsNullOrEmpty(userIdValue)||
            !int.TryParse(userIdValue, out var userId))
            {
                return Unauthorized(new
                {
                    message="Invalid or missing user ID in token."
                });
            }

            var ticket= new Ticket
            {
                TicketNumber= $"TKT-{Guid.NewGuid().ToString()[..8].ToUpper()}",
                Subject= request.Subject,
                Description= request.Description,
                CategoryId= request.CategoryId,
                PriorityId= request.PriorityId,
                StatusId= openStatus.ID,
                CreatedAt= DateTime.UtcNow,
                CreatedByUserId= userId 
            };
            _context.Tickets.Add(ticket);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetTicketById),
                new { id= ticket.Id},
                new
                {
                    message= "Ticket created successfully.",
                    ticketId= ticket.Id,
                    ticketNumber= ticket.TicketNumber
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
}

}

