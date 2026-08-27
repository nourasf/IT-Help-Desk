using backend.Data;
using backend.DTOs.Auth;
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
        private readonly EmailService _emailService;

        public AuthController(AppDbContext context, JwtService jwtService, EmailService emailService)
        {
            _context = context;
            _jwtService = jwtService;
            _emailService = emailService;
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email))
                return BadRequest(new { message = "Email is required." });

            var email = request.Email.Trim().ToLower();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            // Do not reveal whether an account exists.
            if (user == null)
                return Ok(new { message = "If an account exists, a verification code has been sent." });

            var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            user.ResetPasswordToken = otp;
            user.ResetPasswordExpiry = DateTime.UtcNow.AddMinutes(10);
            await _context.SaveChangesAsync();

            var delivered = await _emailService.SendTicketNotificationAsync(
                user.Email,
                user.FullName,
                "SupportHub password reset code",
                $"Your SupportHub verification code is {otp}. It expires in 10 minutes.");

            if (!delivered)
            {
                user.ResetPasswordToken = null;
                user.ResetPasswordExpiry = null;
                await _context.SaveChangesAsync();
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = "Password recovery email is currently unavailable. Please contact an administrator."
                });
            }

            return Ok(new { message = "A verification code has been sent to your email." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.ResetToken) || string.IsNullOrWhiteSpace(request.NewPassword))
                return BadRequest(new { message = "Email, reset token, and new password are required." });

            if (request.NewPassword.Length < 8)
                return BadRequest(new { message = "Password must contain at least 8 characters." });

            var email = request.Email.Trim().ToLower();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null || string.IsNullOrWhiteSpace(user.ResetPasswordToken) || user.ResetPasswordExpiry == null)
                return BadRequest(new { message = "Invalid or expired password reset request." });

            if (user.ResetPasswordExpiry < DateTime.UtcNow)
            {
                user.ResetPasswordToken = null;
                user.ResetPasswordExpiry = null;
                await _context.SaveChangesAsync();
                return BadRequest(new { message = "The password reset request has expired." });
            }

            if (user.ResetPasswordToken != request.ResetToken)
                return BadRequest(new { message = "Invalid password reset token." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.ResetPasswordToken = null;
            user.ResetPasswordExpiry = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password reset successfully." });
        }

        [HttpPost("verify-reset-otp")]
        public async Task<IActionResult> VerifyResetOtp(VerifyResetOtpRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Otp))
                return BadRequest(new { message = "Email and verification code are required." });

            var email = request.Email.Trim().ToLower();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null || string.IsNullOrWhiteSpace(user.ResetPasswordToken) || user.ResetPasswordExpiry == null)
                return BadRequest(new { message = "Invalid or expired verification code." });

            if (user.ResetPasswordExpiry < DateTime.UtcNow)
            {
                user.ResetPasswordToken = null;
                user.ResetPasswordExpiry = null;
                await _context.SaveChangesAsync();
                return BadRequest(new { message = "The verification code has expired." });
            }

            if (user.ResetPasswordToken != request.Otp.Trim())
                return BadRequest(new { message = "Invalid verification code." });

            var resetToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            user.ResetPasswordToken = resetToken;
            user.ResetPasswordExpiry = DateTime.UtcNow.AddMinutes(10);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Verification code confirmed.", resetToken });
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { message = "Email and password are required." });

            var email = request.Email.Trim().ToLower();
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return Unauthorized(new { message = "Invalid email or password." });

            var token = _jwtService.GenerateToken(user);
            return Ok(new LoginResponseDto
            {
                Token = token,
                Role = user.Role?.Name ?? "Employee"
            });
        }
    }
}
