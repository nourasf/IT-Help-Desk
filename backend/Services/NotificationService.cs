using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class NotificationService
{
    private readonly AppDbContext _context;

    public NotificationService(AppDbContext context)
    {
        _context = context;
    }

    public Task CreateNotificationAsync(
        int userId,
        string title,
        string message,
        string type,
        int? ticketId = null)
    {
        _context.Notifications.Add(new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            TicketId = ticketId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        return Task.CompletedTask;
    }

    public async Task CreateNotificationsAsync(
        IEnumerable<int> userIds,
        string title,
        string message,
        string type,
        int? ticketId = null)
    {
        var recipients = userIds.Distinct().ToHashSet();

        // Admins should receive system-level ticket events even when the caller
        // originally targets only managers/employees/agents.
        var adminVisibleTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "TicketCreated",
            "CommentAdded",
            "TicketResolved",
            "TicketEscalated",
            "TicketCancelled",
            "TicketReopened",
            "TicketClosed",
            "TicketReturned"
        };

        if (adminVisibleTypes.Contains(type))
        {
            var adminIds = await GetUserIdsByRoleAsync("Admin");
            foreach (var adminId in adminIds)
                recipients.Add(adminId);
        }

        foreach (var userId in recipients)
        {
            _context.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = title,
                Message = message,
                Type = type,
                TicketId = ticketId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    public async Task<List<int>> GetUserIdsByRoleAsync(params string[] roleNames)
    {
        var normalizedRoles = roleNames
            .Select(role => role.Trim().ToLower())
            .ToList();

        return await _context.Users
            .AsNoTracking()
            .Where(user =>
                user.Role != null &&
                normalizedRoles.Contains(user.Role.Name.Trim().ToLower()))
            .Select(user => user.ID)
            .ToListAsync();
    }
}
