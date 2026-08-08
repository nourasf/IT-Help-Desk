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

    public Task CreateNotificationsAsync(
        IEnumerable<int> userIds,
        string title,
        string message,
        string type,
        int? ticketId = null)
    {
        foreach (var userId in userIds.Distinct())
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

        return Task.CompletedTask;
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
