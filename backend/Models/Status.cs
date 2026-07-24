namespace backend.Models
{
    public class Status
    {
     public int ID {get;set;}
    
     public String StatusName {get;set;}= string.Empty;

     public int OrderNumber {get;set;}

     public String StatusColor {get;set;}= string.Empty;

        public ICollection<Ticket> Tickets {get;set;} = new List<Ticket>();
        

    }
}