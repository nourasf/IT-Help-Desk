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

    public async Task<string> ChatAsync(
        string message,
        List<AiChatHistoryMessage>? history,
        string userRole)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            throw new ArgumentException("Message cannot be empty.");
        }

        var normalizedRole = string.IsNullOrWhiteSpace(userRole)
            ? "Employee"
            : userRole.Trim();

        var roleGuidance = normalizedRole.ToLowerInvariant() switch
        {
            "employee" => "Help the employee troubleshoot safely. If the problem still needs technical intervention, recommend creating a support ticket.",
            "manager" => "Help the manager understand likely causes, impact, categorization, priority, and useful next steps. Do not tell the manager to create an employee ticket.",
            "admin" => "Help the administrator with practical IT and help-desk system troubleshooting. Keep suggestions operational and concise.",
            "agent" => "Help the IT support agent diagnose likely causes, choose efficient troubleshooting steps, and identify what evidence to collect.",
            "it support agent" => "Help the IT support agent diagnose likely causes, choose efficient troubleshooting steps, and identify what evidence to collect.",
            _ => "Provide concise, practical IT support guidance appropriate to the signed-in user's role."
        };

        var safeHistory = (history ?? new List<AiChatHistoryMessage>())
            .Where(item =>
                !string.IsNullOrWhiteSpace(item.Text) &&
                (string.Equals(item.Role, "user", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(item.Role, "assistant", StringComparison.OrdinalIgnoreCase)))
            .TakeLast(10)
            .Select(item => $"{(item.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase) ? "SupportHub AI" : "User")}: {item.Text.Trim()}")
            .ToList();

        var conversation = safeHistory.Count == 0
            ? "No previous messages in this conversation."
            : string.Join("\n", safeHistory);

        var prompt = $$"""
You are SupportHub AI, a concise IT help desk assistant.

Signed-in role: {{normalizedRole}}
Role-specific instruction: {{roleGuidance}}

STRICT RESPONSE RULES:
- Never reveal internal reasoning, chain-of-thought, analysis, planning, or <think> content.
- Output only the final answer that should be shown to the user.
- Keep the entire answer under 120 words.
- Use at most 4 short troubleshooting steps.
- Use previous conversation messages when the new message refers to something said earlier.
- Do not repeat steps the user explicitly says they already tried unless there is a strong reason.
- Skip long introductions and explanations.
- Use simple, practical language.
- Do not invent company-specific policies, passwords, server names, or procedures.
- If the issue may require administrator access, security review, hardware repair, or escalation, say so briefly.
- Do not claim a step fixed the issue unless the user confirms it.
- Stay focused on IT support.

Recent conversation:
{{conversation}}

New user message:
{{message.Trim()}}
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

        var closingThinkIndex = cleaned.LastIndexOf("</think>", StringComparison.OrdinalIgnoreCase);
        if (closingThinkIndex >= 0)
        {
            cleaned = cleaned[(closingThinkIndex + "</think>".Length)..].Trim();
        }

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
