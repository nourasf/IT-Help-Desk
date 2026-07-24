using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly JwtService _jwtService;

        public AuthController(
            AppDbContext context,
            JwtService jwtService)
        {
            _context = context;
            _jwtService = jwtService;
        }

        [HttpPost("forgot-password")]

        public async Task<IActionResult> ForgotPassword(
            ForgotPasswordRequest request
        )
        {
            var user= await _context.Users
            .FirstOrDefaultAsync (u=> u.Email == request.Email);

            if(user==null)
            {
                return Ok(new
                {
                    message="if the email exists, a password reset link has been created."

                });

            }
            var tokenBytes= RandomNumberGenerator.GetBytes(32);
            var resetToken= Convert.ToHexString(tokenBytes);

            user.ResetPasswordToken=resetToken;
            user.ResetPasswordExpiry= DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message="Password reset token created.",
                token= resetToken
            });
        }
        
[HttpPost("reset-password")]
public async Task<IActionResult> ResetPassword(
    ResetPasswordRequest request
)
{
    var user = await _context.Users.FirstOrDefaultAsync(u =>
        u.ResetPasswordToken == request.Token &&
        u.ResetPasswordExpiry > DateTime.UtcNow
    );

    if (user == null)
    {
        return BadRequest(new
        {
            message = "The reset token is invalid or has expired."
        });
    }

    var passwordHasher = new PasswordHasher<User>();

    user.PasswordHash = passwordHasher.HashPassword(
        user,
        request.NewPassword
    );

    user.ResetPasswordToken = null;
    user.ResetPasswordExpiry = null;

    await _context.SaveChangesAsync();

    return Ok(new
    {
        message = "Password reset successfully."
    });
}


        [HttpPost("login")]
        public async Task<ActionResult<LoginResponseDto>> Login(
            LoginRequestDto request)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user == null)
            {
                return Unauthorized("Invalid email or password.");
            }

            var passwordIsValid = BCrypt.Net.BCrypt.Verify(
                request.Password,
                user.PasswordHash
            );

            if (!passwordIsValid)
            {
                return Unauthorized("Invalid email or password.");
            }

            var token = _jwtService.GenerateToken(user);

            var response = new LoginResponseDto
            {
                Token = token,
                Role = user.Role?.Name ?? "Employee"
            };

            return Ok(response);
        }

[HttpPost("register")]
public async Task<IActionResult>Register(RegisterRequestDto request)
        {
            var emailExists= await _context.Users
            .AnyAsync(u=>u.Email==request.Email);

            if(emailExists)
            {
                return BadRequest(new
                {
                    message="Email already exists."
                });
            }
            var employeeRole= await _context.Roles
            .FirstOrDefaultAsync(r=>r.Name=="Employee");

            if(employeeRole==null)
            {
                return BadRequest(new
                {
                    message="Employee role does not exist."
                });
            }
            var user= new User
            {
                FullName=request.FullName,
                Email=request.Email,
                PasswordHash=BCrypt.Net.BCrypt.HashPassword(request.Password),
                RoleID=employeeRole.ID
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message="User registered successfully."
            });
        }

    }
}

