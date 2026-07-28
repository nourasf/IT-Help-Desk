namespace backend.DTOs.Tickets;

public class CreateTicketRequest
{
public String Subject {get;set;}= string.Empty;
public String Description {get;set;}= string.Empty;

public int CategoryId {get;set;}

public int PriorityId {get;set;}

}