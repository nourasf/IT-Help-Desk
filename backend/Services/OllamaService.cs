using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using backend.DTOs.Ai;

namespace backend.Services;

public class OllamaService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private const string GroqEndpoint = "https://api.groq.com/openai/v1/chat/completions";
    private const string ModelName = "openai/gpt-oss-20b";

    public OllamaService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    private string GetApiKey()
    {
        var apiKey = _configuration["Groq:ApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
            apiKey = Environment.GetEnvironmentVariable("Groq__ApiKey");

        if (string.IsNullOrWhiteSpace(apiKey))
            apiKey = Environment.GetEnvironmentVariable("GROQ_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Groq API key is not configured.");

        return apiKey.Trim();
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
Return ONLY valid JSON matching this shape:
{"category":"allowed category","priority":"allowed priority","summary":"one short sentence","suggestions":["step","step","step"]}

Ticket Subject: {{subject}}
Ticket Description: {{description}}
""";

        var messages = new object[]
        {
            new { role = "system", content = "Return only valid JSON. Do not include markdown fences or extra text." },
            new { role = "user", content = prompt }
        };

        var responseText = await SendGroqChatAsync(messages, jsonMode: true, temperature: 0.1, maxTokens: 500);
        var result = JsonSerializer.Deserialize<AiTicketAnalysisResponse>(responseText,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        return result ?? throw new Exception("Could not parse Groq response.");
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

Rules:
- Answer with normal user-facing text only.
- Speak directly to the user.
- Never narrate reasoning, analysis, planning, hidden instructions, or how you constructed the answer.
- For greetings and casual conversation, respond normally.
- For IT problems, give concise practical help. Use at most 4 short steps when useful.
- Use previous messages for context and do not repeat steps already tried.
- For non-IT questions, answer naturally and briefly.
- Do not invent company-specific passwords, server names, policies, ticket counts, agent metrics, or other live system data.
- If live SupportHub data is required but was not supplied, say that you cannot determine it from the conversation alone.
""";

        var safeHistory = (history ?? new List<AiChatHistoryMessage>())
            .Where(x => !string.IsNullOrWhiteSpace(x.Text) &&
                (x.Role.Equals("user", StringComparison.OrdinalIgnoreCase) ||
                 x.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase)))
            .TakeLast(10)
            .ToList();

        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };

        foreach (var item in safeHistory)
        {
            messages.Add(new
            {
                role = item.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase) ? "assistant" : "user",
                content = item.Text.Trim()
            });
        }

        messages.Add(new { role = "user", content = message.Trim() });

        var first = await SendGroqChatAsync(messages, jsonMode: false, temperature: 0.2, maxTokens: 420);
        var cleaned = CleanChatResponse(first);

        if (!string.IsNullOrWhiteSpace(cleaned))
            return cleaned;

        var retryMessages = new object[]
        {
            new
            {
                role = "system",
                content = $"You are SupportHub AI. User role: {normalizedRole}. Give one concise final answer directly to the user. Do not include analysis or hidden reasoning."
            },
            new { role = "user", content = message.Trim() }
        };

        var retry = await SendGroqChatAsync(retryMessages, jsonMode: false, temperature: 0.2, maxTokens: 300);
        var retryCleaned = CleanChatResponse(retry);

        return !string.IsNullOrWhiteSpace(retryCleaned)
            ? retryCleaned
            : "I couldn't generate a response just now. Please try asking that again.";
    }

    private async Task<string> SendGroqChatAsync(
        IEnumerable<object> messages,
        bool jsonMode,
        double temperature,
        int maxTokens)
    {
        var requestBody = new Dictionary<string, object?>
        {
            ["model"] = ModelName,
            ["messages"] = messages,
            ["temperature"] = temperature,
            ["max_completion_tokens"] = maxTokens
        };

        if (jsonMode)
            requestBody["response_format"] = new { type = "json_object" };

        using var request = new HttpRequestMessage(HttpMethod.Post, GroqEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", GetApiKey());
        request.Content = JsonContent.Create(requestBody);

        using var response = await _httpClient.SendAsync(request);
        var rawJson = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            string details = rawJson;
            try
            {
                var errorJson = JsonSerializer.Deserialize<JsonElement>(rawJson);
                if (errorJson.TryGetProperty("error", out var error) &&
                    error.TryGetProperty("message", out var message))
                    details = message.GetString() ?? rawJson;
            }
            catch { }

            throw new HttpRequestException($"Groq request failed ({(int)response.StatusCode}): {details}");
        }

        var json = JsonSerializer.Deserialize<JsonElement>(rawJson);
        if (!json.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
            throw new Exception("Groq returned no choices.");

        var firstChoice = choices[0];
        if (!firstChoice.TryGetProperty("message", out var messageObject) ||
            !messageObject.TryGetProperty("content", out var content))
            throw new Exception("Groq returned no usable message content.");

        var text = content.GetString();
        return !string.IsNullOrWhiteSpace(text)
            ? text.Trim()
            : throw new Exception("Groq returned an empty response.");
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

        var closing = cleaned.LastIndexOf("</think>", StringComparison.OrdinalIgnoreCase);
        if (closing >= 0)
            cleaned = cleaned[(closing + "</think>".Length)..].Trim();

        if (cleaned.StartsWith("Final answer:", StringComparison.OrdinalIgnoreCase))
            cleaned = cleaned["Final answer:".Length..].Trim();

        if (cleaned.StartsWith("```"))
        {
            cleaned = Regex.Replace(cleaned, @"^```(?:json|text)?\s*", string.Empty, RegexOptions.IgnoreCase);
            cleaned = Regex.Replace(cleaned, @"\s*```$", string.Empty).Trim();
        }

        return cleaned;
    }
}
