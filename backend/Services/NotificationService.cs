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
    private readonly EmailService _emailService;

    public NotificationService(
        AppDbContext context,
        IHubContext<NotificationHub> hub,
        EmailService emailService)
    {
        _context = context;
        _hub = hub;
        _emailService = emailService;
    }

    private static bool ShouldSendEmail(string type)
    {
        return type.Equals("TicketCreated", StringComparison.OrdinalIgnoreCase) ||
               type.Equals("TicketAssigned", StringComparison.OrdinalIgnoreCase) ||
               type.Equals("TicketReassigned", StringComparison.OrdinalIgnoreCase) ||
               type.Equals("TicketTaken", StringComparison.OrdinalIgnoreCase);
    }

    public async Task CreateNotificationAsync(
        int userId,
        string title,
        string message,
        string type,
        int? ticketId = null)
    {
        var notification = new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            TicketId = ticketId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);

        await _hub.Clients.Group($"user:{userId}")
            .SendAsync("NotificationReceived", new
            {
                title,
                message,
                type,
                ticketId,
                createdAt = notification.CreatedAt
            });

        if (ShouldSendEmail(type))
        {
            var recipient = await _context.Users
                .AsNoTracking()
                .Where(user => user.ID == userId)
                .Select(user => new { user.Email, user.FullName })
                .FirstOrDefaultAsync();

            if (recipient != null)
            {
                await _emailService.SendTicketNotificationAsync(
                    recipient.Email,
                    recipient.FullName,
                    title,
                    message,
                    ticketId);
            }
        }
    }

    public async Task CreateNotificationsAsync(
        IEnumerable<int> userIds,
        string title,
        string message,
        string type,
        int? ticketId = null)
    {
        var recipients = userIds.Distinct().ToHashSet();

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

        var createdAt = DateTime.UtcNow;

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
                CreatedAt = createdAt
            });

            await _hub.Clients.Group($"user:{userId}")
                .SendAsync("NotificationReceived", new
                {
                    title,
                    message,
                    type,
                    ticketId,
                    createdAt
                });
        }

        if (ShouldSendEmail(type) && recipients.Count > 0)
        {
            var emailRecipients = await _context.Users
                .AsNoTracking()
                .Where(user => recipients.Contains(user.ID))
                .Select(user => new
                {
                    user.ID,
                    user.Email,
                    user.FullName
                })
                .ToListAsync();

            foreach (var recipient in emailRecipients)
            {
                await _emailService.SendTicketNotificationAsync(
                    recipient.Email,
                    recipient.FullName,
                    title,
                    message,
                    ticketId);
            }
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
