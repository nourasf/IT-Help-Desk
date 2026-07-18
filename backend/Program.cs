using System.Text;
using backend.Data;
using backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Allows us to create API controller classes.
builder.Services.AddControllers();

// Generates the OpenAPI document for testing/documentation.
builder.Services.AddOpenApi();

// Connect Entity Framework to SQL Server.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")
    )
);

// Read the JWT settings from appsettings.json.
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("JWT key is missing.");

var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("JWT issuer is missing.");

var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("JWT audience is missing.");

// Configure JWT authentication.
builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme =
            JwtBearerDefaults.AuthenticationScheme;

        options.DefaultChallengeScheme =
            JwtBearerDefaults.AuthenticationScheme;
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

            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)
            ),

            ClockSkew = TimeSpan.Zero
        };
    });

// Enables authorization attributes such as [Authorize].
builder.Services.AddAuthorization();

builder.Services.AddScoped<JwtService>();


var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// JWT must be checked before authorization.
app.UseAuthentication();
app.UseAuthorization();

// Finds endpoints defined inside Controllers.
app.MapControllers();

app.Run();