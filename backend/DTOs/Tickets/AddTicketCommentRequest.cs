using System.ComponentModel.DataAnnotations;

namespace backend.DTOs.Tickets
{
    public class AddTicketCommentRequest
    {
        [Required]
      [MaxLength(2000)]
        public string Comment { get; set; }= string.Empty;
        
    }
}