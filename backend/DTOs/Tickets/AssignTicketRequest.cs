using System.ComponentModel.DataAnnotations;

namespace backend.DTOs.Tickets;
public class AssignTicketRequest
{
 [Range(1,int.MaxValue)]
 public int AgentUserId {get;set;}
 
}