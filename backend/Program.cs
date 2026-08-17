using System.Security.Claims;
using System.Text;
using backend.Data;
using backend.Hubs;
using backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT key is missing.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT issuer is missing.");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new InvalidOperationException("JWT audience is missing.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.Request.Path.StartsWithSegments("/hubs/notifications"))
                context.Token = accessToken;
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<AttachmentService>();
builder.Services.AddHttpClient<OllamaService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();
if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();

app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
    var ticketId = 0;
    var isTicketRoute = segments.Length >= 4 &&
        segments[0].Equals("api", StringComparison.OrdinalIgnoreCase) &&
        segments[1].Equals("tickets", StringComparison.OrdinalIgnoreCase) &&
        int.TryParse(segments[2], out ticketId);

    var isHistoryRequest = isTicketRoute &&
        HttpMethods.IsGet(context.Request.Method) &&
        segments.Length == 4 &&
        segments[3].Equals("history", StringComparison.OrdinalIgnoreCase);

    var isInternalNotePost = isTicketRoute &&
        HttpMethods.IsPost(context.Request.Method) &&
        segments.Length == 4 &&
        segments[3].Equals("internal-notes", StringComparison.OrdinalIgnoreCase);

    if ((isHistoryRequest || isInternalNotePost) &&
        !context.User.IsInRole("Manager") &&
        !context.User.IsInRole("Admin"))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new
        {
            message = isHistoryRequest
                ? "Ticket history is available to managers and administrators only."
                : "Only managers and administrators can add internal notes."
        });
        return;
    }

    await next();

    if (!isInternalNotePost || context.Response.StatusCode < 200 || context.Response.StatusCode >= 300)
        return;

    try
    {
        var db = context.RequestServices.GetRequiredService<AppDbContext>();
        var ticket = await db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == ticketId && !t.IsDeleted)
            .Select(t => new
            {
                t.Id,
                t.TicketNumber,
                t.Subject,
                t.AssignedToUserId
            })
            .FirstOrDefaultAsync();

        var currentUserIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        _ = int.TryParse(currentUserIdValue, out var currentUserId);

        if (ticket?.AssignedToUserId is int agentId && agentId != currentUserId)
        {
            var notificationService = context.RequestServices.GetRequiredService<NotificationService>();
            await notificationService.CreateNotificationAsync(
                agentId,
                "New Internal Note",
                $"A manager or administrator added an internal note to {ticket.TicketNumber} - {ticket.Subject}.",
                "InternalNoteAdded",
                ticket.Id
            );
        }
    }
    catch
    {
        // The note has already been saved; notification delivery should not turn it into a failed request.
    }
});

app.UseAuthorization();
app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();
