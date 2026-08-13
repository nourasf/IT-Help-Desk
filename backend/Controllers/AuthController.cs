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
                    message = "If the email exists, a verification code has been created."
                });
            }

            var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            user.ResetPasswordToken = otp;
            user.ResetPasswordExpiry = DateTime.UtcNow.AddMinutes(10);
            await _context.SaveChangesAsync();

            // Development only: there is no email provider configured yet,
            // so return the OTP so the local frontend can display it.
            // When email is added, remove devOtp and send this code by email instead.
            return Ok(new
            {
                message = "A 6-digit verification code was created. It expires in 10 minutes.",
                devOtp = otp,
                expiresAt = user.ResetPasswordExpiry
            });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new
                {
                    message = "Email address is required."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Otp) || request.Otp.Length != 6 || !request.Otp.All(char.IsDigit))
            {
                return BadRequest(new
                {
                    message = "Enter the 6-digit verification code."
                });
            }

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            {
                return BadRequest(new
                {
                    message = "The new password must contain at least 8 characters."
                });
            }

            var email = request.Email.Trim();
            var otp = request.Otp.Trim();

            var user = await _context.Users.FirstOrDefaultAsync(u =>
                u.Email.ToLower() == email.ToLower() &&
                u.ResetPasswordToken == otp &&
                u.ResetPasswordExpiry.HasValue &&
                u.ResetPasswordExpiry.Value > DateTime.UtcNow
            );

            if (user == null)
            {
                return BadRequest(new
                {
                    message = "The verification code is invalid or has expired."
                });
            }

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
