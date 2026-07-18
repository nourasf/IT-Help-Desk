using System.IdentityModel.Tokens.Jwt; //creates token
using System.Security.Claims; //stores info inside token
using System.Text; //converts string to byte array
using Microsoft.IdentityModel.Tokens; //validates token
using backend.Models; 

namespace backend.Services
{
    public class JwtService
    {
        private readonly IConfiguration _configuration;
        
        public JwtService(IConfiguration configuration)
        {
            _configuration = configuration;
        }
        public string GenerateToken(User user) //generates token for user
        {
            var jwtKey=_configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT key is missing.");

            var jwtIssuer=_configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException("JWT issuer is missing.");
            
            var jwtAudience=_configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException("JWT audience is missing.");

            var expiryMinutes= _configuration.GetValue<int>("Jwt:ExpiryMinutes");

            var claims = new List<Claim> 
            {
                new Claim (
                    ClaimTypes.NameIdentifier,
                    user.ID.ToString()
                ),
                new Claim(
                    ClaimTypes.Name,
                    user.FullName
                ),
                new Claim(
                    ClaimTypes.Email,
                    user.Email
                ),
                new Claim(
                    ClaimTypes.Role,
                    user.Role?.Name ?? "Employee"
                )
            };
            var key= new SymmetricSecurityKey( //creates a key from the jwtKey string
                Encoding.UTF8.GetBytes(jwtKey));

                var creds = new SigningCredentials( //creates a signing credentials object using the key and algorithm
                    key, 
                    SecurityAlgorithms.HmacSha256);

                    var token= new JwtSecurityToken( 
                        issuer: jwtIssuer,
                        audience: jwtAudience,
                        claims: claims,
                        expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
                        signingCredentials: creds
                    );
                    return new JwtSecurityTokenHandler().WriteToken(token);

        }
    }
}
