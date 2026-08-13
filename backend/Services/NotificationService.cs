using backend.Data;
using backend.Hubs;
using backend.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class NotificationService
{
    private readonly AppDbContext _context;
    private readonly IHubContext<NotificationHub> _hub;

    public NotificationService(AppDbContext context, IHubContext<NotificationHub> hub)
    {
        _context = context;
        _hub = hub;
    }

    public async Task CreateNotificationAsync(int userId, string title, string message, string type, int? ticketId = null)
    {
        var notification = new Notification { UserId = userId, Title = title, Message = message, Type = type, TicketId = ticketId, IsRead = false, CreatedAt = DateTime.UtcNow };
        _context.Notifications.Add(notification);
        await _hub.Clients.Group($"user:{userId}").SendAsync("NotificationReceived", new { title, message, type, ticketId, createdAt = notification.CreatedAt });
    }

    public async Task CreateNotificationsAsync(IEnumerable<int> userIds, string title, string message, string type, int? ticketId = null)
    {
        var recipients = userIds.Distinct().ToHashSet();
        var adminVisibleTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "TicketCreated", "CommentAdded", "TicketResolved", "TicketEscalated", "TicketCancelled", "TicketReopened", "TicketClosed", "TicketReturned"
        };

        if (adminVisibleTypes.Contains(type))
        {
            var adminIds = await GetUserIdsByRoleAsync("Admin");
            foreach (var adminId in adminIds) recipients.Add(adminId);
        }

        var createdAt = DateTime.UtcNow;
        foreach (var userId in recipients)
        {
            _context.Notifications.Add(new Notification { UserId = userId, Title = title, Message = message, Type = type, TicketId = ticketId, IsRead = false, CreatedAt = createdAt });
            await _hub.Clients.Group($"user:{userId}").SendAsync("NotificationReceived", new { title, message, type, ticketId, createdAt });
        }
    }

    public async Task<List<int>> GetUserIdsByRoleAsync(params string[] roleNames)
    {
        var normalizedRoles = roleNames.Select(role => role.Trim().ToLower()).ToList();
        return await _context.Users.AsNoTracking().Where(user => user.Role != null && normalizedRoles.Contains(user.Role.Name.Trim().ToLower())).Select(user => user.ID).ToListAsync();
    }
}
