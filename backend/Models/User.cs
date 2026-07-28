namespace backend.Models
{
    public class User
    {
        public int ID{ get; set;}
        public string FullName {get; set;} = string.Empty;

        public String Email { get; set;} = string.Empty;

        public String PasswordHash{get; set;} = string.Empty;

        public String? ResetPasswordToken {get; set;}

        public DateTime? ResetPasswordExpiry {get; set;}

        public int RoleID { get; set; }

        public Role? Role {get; set;}
        public ICollection<TicketComment> TicketComments { get; set; }
    = new List<TicketComment>();

    public ICollection<TicketHistory> TicketHistoryChanges { get; set; }
    = new List<TicketHistory>();
    
    }
}