using backend.Data;
using backend.DTOs.Users;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser(CreateUserRequestDto request)
        {
            var email = request.Email.Trim();
            var normalizedEmail = email.ToLower();

            var emailExists = await _context.Users
                .AnyAsync(user => user.Email.ToLower() == normalizedEmail);

            if (emailExists)
            {
                return Conflict(new
                {
                    message = "A user with this email already exists."
                });
            }

            var roleName = request.Role.Trim();
            var normalizedRoleName = roleName.ToLower();

            var role = await _context.Roles
                .FirstOrDefaultAsync(existingRole =>
                    existingRole.Name.ToLower() == normalizedRoleName);

            if (role == null)
            {
                return BadRequest(new
                {
                    message = "Invalid role."
                });
            }

            var user = new User
            {
                FullName = request.FullName.Trim(),
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                RoleID = role.ID
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return StatusCode(StatusCodes.Status201Created, new
            {
                message = "User created successfully.",
                user = new
                {
                    user.ID,
                    user.FullName,
                    user.Email,
                    Role = role.Name
                }
            });
        }
    }
}
