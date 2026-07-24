namespace backend.Models
{
  public class Category
  {
    public int ID { get; set; }
    public string Name { get; set; } = string.Empty;

    public String? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();
  }
}