using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public class EmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_configuration["Email:SmtpHost"]) &&
        int.TryParse(_configuration["Email:SmtpPort"], out _) &&
        !string.IsNullOrWhiteSpace(_configuration["Email:FromAddress"]);

    public async Task<bool> SendTicketNotificationAsync(
        string recipientEmail,
        string recipientName,
        string subject,
        string message,
        int? ticketId = null)
    {
        if (string.IsNullOrWhiteSpace(recipientEmail))
            return false;

        if (!IsConfigured)
        {
            _logger.LogInformation(
                "Email delivery skipped because SMTP is not configured. Recipient: {Recipient}",
                recipientEmail);
            return false;
        }

        var smtpHost = _configuration["Email:SmtpHost"]!;
        var smtpPort = int.Parse(_configuration["Email:SmtpPort"]!);
        var smtpUser = _configuration["Email:SmtpUser"];
        var smtpPassword = _configuration["Email:SmtpPassword"];
        var fromAddress = _configuration["Email:FromAddress"]!;
        var fromName = _configuration["Email:FromName"] ?? "SupportHub";
        var enableSsl = !bool.TryParse(_configuration["Email:EnableSsl"], out var ssl) || ssl;
        var frontendBaseUrl = (_configuration["Email:FrontendBaseUrl"] ?? "http://localhost:5173").TrimEnd('/');

        var ticketUrl = ticketId.HasValue
            ? $"{frontendBaseUrl}/tickets/{ticketId.Value}"
            : frontendBaseUrl;

        var safeName = WebUtility.HtmlEncode(recipientName);
        var safeMessage = WebUtility.HtmlEncode(message).Replace("\n", "<br />");
        var safeUrl = WebUtility.HtmlEncode(ticketUrl);

        var body = $"""
            <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#29263f;line-height:1.55">
              <h2 style="margin-bottom:8px">{WebUtility.HtmlEncode(subject)}</h2>
              <p>Hello {safeName},</p>
              <p>{safeMessage}</p>
              {(ticketId.HasValue ? $"<p><a href=\"{safeUrl}\" style=\"display:inline-block;padding:10px 16px;background:#5b4bb7;color:white;text-decoration:none;border-radius:8px\">Open Ticket</a></p>" : string.Empty)}
              <p style="font-size:12px;color:#777;margin-top:28px">SupportHub IT Help Desk</p>
            </div>
            """;

        using var mail = new MailMessage
        {
            From = new MailAddress(fromAddress, fromName),
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };

        mail.To.Add(new MailAddress(recipientEmail, recipientName));

        using var smtp = new SmtpClient(smtpHost, smtpPort)
        {
            EnableSsl = enableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false
        };

        if (!string.IsNullOrWhiteSpace(smtpUser))
            smtp.Credentials = new NetworkCredential(smtpUser, smtpPassword);

        try
        {
            await smtp.SendMailAsync(mail);
            return true;
        }
        catch (Exception ex)
        {
            // Email must never cause the ticket operation itself to fail.
            _logger.LogError(ex, "Failed to send ticket email to {Recipient}", recipientEmail);
            return false;
        }
    }
}
