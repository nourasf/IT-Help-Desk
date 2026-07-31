using System.ComponentModel.DataAnnotations;

namespace backend.DTOs.Tickets;

public class CreateTicketRequest
{
    [Required]
    [MaxLength(150)]
    public string Subject { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string Category { get; set; } = string.Empty;

    [Required]
    public string Priority { get; set; } = string.Empty;
}
