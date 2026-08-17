namespace backend.DTOs.Ai;

public class AiTicketAnalysisResponse
{
    public string Category { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public List<string> Suggestions { get; set; } = new();
}