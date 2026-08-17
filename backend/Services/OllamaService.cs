using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
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
            think = false
        };

        var response = await _httpClient.PostAsJsonAsync(
            "http://localhost:11434/api/generate",
            request
        );

        response.EnsureSuccessStatusCode();

        var responseText = await ReadOllamaTextAsync(response);

        var result = JsonSerializer.Deserialize<AiTicketAnalysisResponse>(
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

    public async Task<string> ChatAsync(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            throw new ArgumentException("Message cannot be empty.");
        }

        var prompt = $$"""
You are SupportHub AI, a concise IT help desk assistant.

Help the employee troubleshoot the issue below.

STRICT RESPONSE RULES:
- Never reveal internal reasoning, chain-of-thought, analysis, planning, or <think> content.
- Output only the final answer that should be shown to the employee.
- Keep the entire answer under 120 words.
- Use at most 4 short troubleshooting steps.
- Skip long introductions and explanations.
- Use simple, practical language.
- Do not invent company-specific policies, passwords, server names, or procedures.
- If the issue may require administrator access, security review, hardware repair, or the steps do not solve it, end with one short sentence recommending IT support.
- Do not claim a step fixed the issue unless the employee confirms it.
- Stay focused on IT support.

Employee message:
{{message}}
""";

        var request = new
        {
            model = "qwen3:4b",
            prompt,
            stream = false,
            think = false,
            options = new
            {
                num_predict = 180,
                temperature = 0.2
            }
        };

        var response = await _httpClient.PostAsJsonAsync(
            "http://localhost:11434/api/generate",
            request
        );

        response.EnsureSuccessStatusCode();

        var responseText = await ReadOllamaTextAsync(response);
        return CleanChatResponse(responseText);
    }

    private static string CleanChatResponse(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var cleaned = Regex.Replace(
            text,
            @"<think>[\s\S]*?</think>",
            string.Empty,
            RegexOptions.IgnoreCase
        ).Trim();

        if (cleaned.StartsWith("Final answer:", StringComparison.OrdinalIgnoreCase))
        {
            cleaned = cleaned["Final answer:".Length..].Trim();
        }

        return cleaned;
    }

    private static async Task<string> ReadOllamaTextAsync(HttpResponseMessage response)
    {
        var rawJson = await response.Content.ReadAsStringAsync();
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

        return responseText.Trim();
    }
}
