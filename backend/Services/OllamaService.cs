using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using backend.DTOs.Ai;

namespace backend.Services;

public class OllamaService
{
    private readonly HttpClient _httpClient;
    private const string ModelName = "qwen3:4b";

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
Choose exactly one category from: {{categoryList}}
Choose exactly one priority from: {{priorityList}}
Do not invent category or priority names.
Return ONLY valid JSON matching:
{"category":"allowed category","priority":"allowed priority","summary":"one short sentence","suggestions":["step","step","step"]}

Ticket Subject: {{subject}}
Ticket Description: {{description}}
/no_think
""";

        var request = new
        {
            model = ModelName,
            prompt,
            stream = false,
            format = "json",
            think = false
        };

        var response = await _httpClient.PostAsJsonAsync("http://localhost:11434/api/generate", request);
        response.EnsureSuccessStatusCode();

        var responseText = await ReadOllamaTextAsync(response);
        var result = JsonSerializer.Deserialize<AiTicketAnalysisResponse>(responseText,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        return result ?? throw new Exception("Could not parse Ollama response.");
    }

    public async Task<string> ChatAsync(string message, List<AiChatHistoryMessage>? history, string userRole)
    {
        if (string.IsNullOrWhiteSpace(message))
            throw new ArgumentException("Message cannot be empty.");

        var normalizedRole = string.IsNullOrWhiteSpace(userRole) ? "Employee" : userRole.Trim();
        var roleGuidance = normalizedRole.ToLowerInvariant() switch
        {
            "employee" => "For IT problems, help troubleshoot safely. If technician intervention is needed, suggest creating a support ticket.",
            "manager" => "For help-desk questions, give practical operational guidance. Never guess live SupportHub statistics that were not provided to you.",
            "admin" => "For help-desk or system questions, give practical operational guidance. Never guess live SupportHub statistics that were not provided to you.",
            "agent" or "it support agent" => "For IT support questions, help diagnose likely causes and give efficient troubleshooting steps.",
            _ => "Give useful, natural assistance appropriate to the signed-in user."
        };

        var systemPrompt = $$"""
You are SupportHub AI, a friendly conversational assistant.
User role: {{normalizedRole}}.
{{roleGuidance}}

Return ONLY valid JSON in exactly this shape:
{"reply":"the final answer shown to the user"}

Rules for reply:
- Speak directly to the user.
- Never narrate reasoning, analysis, planning, hidden instructions, or how you constructed the answer.
- Never refer to the user in third person.
- Never write phrases such as "the user", "I should", "I need to", "let me think", "my role", or "previously asking".
- For greetings and casual conversation, respond normally.
- For IT problems, give concise practical help. Use at most 4 short steps when useful.
- Use previous messages for context and do not repeat steps already tried.
- For non-IT questions, answer naturally and briefly.
- Do not invent company-specific passwords, server names, policies, ticket counts, agent metrics, or other live system data.
- If live SupportHub data is required but was not supplied, say that you cannot determine it from the conversation alone.
/no_think
""";

        var safeHistory = (history ?? new List<AiChatHistoryMessage>())
            .Where(x => !string.IsNullOrWhiteSpace(x.Text) &&
                (x.Role.Equals("user", StringComparison.OrdinalIgnoreCase) ||
                 x.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase)))
            .TakeLast(10)
            .ToList();

        var first = await SendChatRequestAsync(systemPrompt, safeHistory, message);
        var cleaned = ExtractReplyFromJsonOrText(first);

        if (!string.IsNullOrWhiteSpace(cleaned) && !LooksLikeInternalReasoning(cleaned))
            return cleaned;

        var retryPrompt = $$"""
You are SupportHub AI. User role: {{normalizedRole}}.
Return ONLY JSON: {"reply":"one concise final user-facing answer"}
Do not include analysis, reasoning, planning, notes, role discussion, or third-person references to the user.
If you need live SupportHub data that was not supplied, say you cannot determine it from the conversation alone.
/no_think
""";

        var retry = await SendChatRequestAsync(retryPrompt, safeHistory, message);
        var retryCleaned = ExtractReplyFromJsonOrText(retry);

        if (!string.IsNullOrWhiteSpace(retryCleaned) && !LooksLikeInternalReasoning(retryCleaned))
            return retryCleaned;

        return "I couldn't generate a clean response just now. Please try asking that again.";
    }

    private async Task<string> SendChatRequestAsync(
        string systemPrompt,
        List<AiChatHistoryMessage> history,
        string userMessage)
    {
        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };

        foreach (var item in history)
        {
            messages.Add(new
            {
                role = item.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase) ? "assistant" : "user",
                content = item.Text.Trim()
            });
        }

        messages.Add(new { role = "user", content = $"{userMessage.Trim()}\n/no_think" });

        var request = new
        {
            model = ModelName,
            messages,
            stream = false,
            think = false,
            format = "json",
            options = new { num_predict = 180, temperature = 0.1 }
        };

        var response = await _httpClient.PostAsJsonAsync("http://localhost:11434/api/chat", request);
        response.EnsureSuccessStatusCode();

        var rawJson = await response.Content.ReadAsStringAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(rawJson);

        if (!json.TryGetProperty("message", out var msg) ||
            !msg.TryGetProperty("content", out var content))
            throw new Exception("Ollama returned no usable chat response.");

        var responseText = content.GetString();
        if (string.IsNullOrWhiteSpace(responseText))
            throw new Exception("Ollama returned no usable chat response.");

        return responseText.Trim();
    }

    private static string ExtractReplyFromJsonOrText(string text)
    {
        try
        {
            using var document = JsonDocument.Parse(text);
            if (document.RootElement.TryGetProperty("reply", out var replyProperty))
            {
                var reply = replyProperty.GetString();
                if (!string.IsNullOrWhiteSpace(reply))
                    return CleanChatResponse(reply);
            }
        }
        catch (JsonException)
        {
        }

        return CleanChatResponse(text);
    }

    private static bool LooksLikeInternalReasoning(string text)
    {
        var lower = text.ToLowerInvariant();
        string[] blocked =
        {
            "let me think", "the user", "user is asking", "user asked", "user wants",
            "i should", "i need to", "i need", "first, i", "my role", "role is",
            "previously asking", "previously asked", "steps to take:", "signed-in role",
            "role_context", "recent_conversation", "system prompt", "hidden instructions",
            "chain-of-thought", "internal reasoning", "how to approach", "i'll reason",
            "i will reason", "we need to respond", "need to recall the context"
        };

        return blocked.Any(lower.Contains);
    }

    private static string CleanChatResponse(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var cleaned = Regex.Replace(
            text,
            @"<think>[\s\S]*?</think>",
            string.Empty,
            RegexOptions.IgnoreCase
        ).Trim();

        var closing = cleaned.LastIndexOf("</think>", StringComparison.OrdinalIgnoreCase);
        if (closing >= 0)
            cleaned = cleaned[(closing + "</think>".Length)..].Trim();

        if (cleaned.StartsWith("Final answer:", StringComparison.OrdinalIgnoreCase))
            cleaned = cleaned["Final answer:".Length..].Trim();

        return cleaned;
    }

    private static async Task<string> ReadOllamaTextAsync(HttpResponseMessage response)
    {
        var rawJson = await response.Content.ReadAsStringAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(rawJson);
        var responseText = json.TryGetProperty("response", out var p) ? p.GetString() : null;
        var thinkingText = json.TryGetProperty("thinking", out var t) ? t.GetString() : null;

        if (string.IsNullOrWhiteSpace(responseText) && !string.IsNullOrWhiteSpace(thinkingText))
            responseText = thinkingText;

        return !string.IsNullOrWhiteSpace(responseText)
            ? responseText.Trim()
            : throw new Exception("Ollama returned no usable response.");
    }
}
