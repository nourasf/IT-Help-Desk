using backend.Data;
using backend.DTOs.Auth;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

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
        public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
        {
            var email = request?.Email?.Trim();

            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new
                {
                    message = "Email address is required."
                });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

            if (user == null)
            {
                return Ok(new
                {
                    message = "If the email exists, password recovery instructions have been created."
                });
            }

            var tokenBytes = RandomNumberGenerator.GetBytes(32);
            var resetToken = Convert.ToHexString(tokenBytes);

            user.ResetPasswordToken = resetToken;
            user.ResetPasswordExpiry = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            // The token is returned because this project currently runs locally without an email provider.
            // The frontend immediately carries it to the reset-password page.
            return Ok(new
            {
                message = "Password recovery is ready.",
                token = resetToken,
                expiresAt = user.ResetPasswordExpiry
            });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new
                {
                    message = "The password reset token is required."
                });
            }

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            {
                return BadRequest(new
                {
                    message = "The new password must contain at least 8 characters."
                });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u =>
                u.ResetPasswordToken == request.Token &&
                u.ResetPasswordExpiry.HasValue &&
                u.ResetPasswordExpiry.Value > DateTime.UtcNow
            );

            if (user == null)
            {
                return BadRequest(new
                {
                    message = "The reset token is invalid or has expired."
                });
            }

            // Login verifies passwords with BCrypt, so password resets must use BCrypt too.
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.ResetPasswordToken = null;
            user.ResetPasswordExpiry = null;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Password reset successfully. You can now sign in with your new password."
            });
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
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
    }
}
