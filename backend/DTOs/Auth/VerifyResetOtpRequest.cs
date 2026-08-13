namespace backend.DTOs.Auth
{
    public class VerifyResetOtpRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
    }
}