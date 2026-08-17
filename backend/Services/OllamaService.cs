using System.Net.Http.Json;
using System.Text.Json;
using backend.DTOs.Ai;

namespace backend.Services;

public class OllamaService
{
    private readonly HttpClient _httpClient;

    public OllamaService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<AiTicketAnalysisResponse> AnalyzeTicketAsync(
        string subject,
        string description,
        List<string> categories,
        List<string> priorities)
    {
        var categoryList = string.Join(", ", categories);
        var priorityList = string.Join(", ", priorities);

        var prompt = $$"""
You are an AI assistant for an IT Help Desk system called SupportHub.

Analyze the ticket below.

You MUST choose exactly one category from this list:
{{categoryList}}

You MUST choose exactly one priority from this list:
{{priorityList}}

Do not invent new category names.
Do not invent new priority names.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations outside the JSON.

The JSON must match this exact structure:

{
  "category": "one allowed category",
  "priority": "one allowed priority",
  "summary": "one short sentence",
  "suggestions": [
    "short troubleshooting step",
    "short troubleshooting step",
    "short troubleshooting step"
  ]
}

Ticket Subject:
{{subject}}

Ticket Description:
{{description}}
""";

        var request = new
        {
            model = "qwen3:4b",
            prompt,
            stream = false,
            format = "json",
            thinl=false
        };

        var response = await _httpClient.PostAsJsonAsync(
            "http://localhost:11434/api/generate",
            request
        );

        response.EnsureSuccessStatusCode();
var rawJson = await response.Content.ReadAsStringAsync();

Console.WriteLine("OLLAMA RAW RESPONSE:");
Console.WriteLine(rawJson);

var ollamaJson = JsonSerializer.Deserialize<JsonElement>(rawJson);

var responseText = ollamaJson.TryGetProperty("response", out var responseProperty)
    ? responseProperty.GetString()
    : null;

var thinkingText = ollamaJson.TryGetProperty("thinking", out var thinkingProperty)
    ? thinkingProperty.GetString()
    : null;

if (string.IsNullOrWhiteSpace(responseText) &&
    !string.IsNullOrWhiteSpace(thinkingText))
{
    responseText = thinkingText;
}

if (string.IsNullOrWhiteSpace(responseText))
{
    throw new Exception("Ollama returned no usable response.");
}

        var result =
            JsonSerializer.Deserialize<AiTicketAnalysisResponse>(
                responseText,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }
            );

        if (result == null)
        {
            throw new Exception("Could not parse Ollama response.");
        }

        return result;
    }
}