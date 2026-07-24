namespace backend.DTOs;

public class UpdateTicketRequest
{
    public String Subject {get;set;}= string.Empty;
    public String Description {get;set;}= string.Empty;

    public int CategoryId {get;set;}

    public int PriorityId {get;set;}

    public int StatusId {get;set;}

    public int? AssignedToUserId {get;set;}

    public string? ResolutionNotes {get;set;}

}