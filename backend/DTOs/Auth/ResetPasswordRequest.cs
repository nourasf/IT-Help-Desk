using backend.DTOs.Auth;

public class ResetPasswordRequest
{
    public String Token {get;set;}= string.Empty;
    public String NewPassword {get;set;}=string.Empty;
    
}