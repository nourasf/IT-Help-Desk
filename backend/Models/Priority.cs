namespace backend.Models
{
    public class Priority
    {
      public int ID { get; set; }

    public String Name { get; set; } = string.Empty;

    public String Level {get;set;}

    public String color{get;set;} = string.Empty;

    public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();

}
}