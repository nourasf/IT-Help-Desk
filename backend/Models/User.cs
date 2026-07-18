namespace backend.Models
{
    public class User
    {
        public int ID{ get; set;}
        public string FullName {get; set;} = string.Empty;

        public String Email { get; set;} = string.Empty;

        public String PasswordHash{get; set;} = string.Empty;

        public int RoleID { get; set; }

        public Role? Role {get; set;}
    }
}