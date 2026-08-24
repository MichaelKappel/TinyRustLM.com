using System.Text.Json;

namespace TinyRustLM.Companion;

internal static class CompanionStrictJson
{
    internal static void RejectDuplicateProperties(byte[] bytes, string code)
    {
        try
        {
            var reader = new Utf8JsonReader(bytes, new JsonReaderOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 64
            });
            var objects = new Stack<HashSet<string>>();
            while (reader.Read())
            {
                if (reader.TokenType == JsonTokenType.StartObject)
                {
                    objects.Push(new HashSet<string>(StringComparer.Ordinal));
                }
                else if (reader.TokenType == JsonTokenType.PropertyName)
                {
                    var property = reader.GetString();
                    if (objects.Count == 0 || property is null || !objects.Peek().Add(property))
                    {
                        throw new CompanionContractException(code);
                    }
                }
                else if (reader.TokenType == JsonTokenType.EndObject)
                {
                    if (objects.Count == 0)
                    {
                        throw new CompanionContractException(code);
                    }
                    objects.Pop();
                }
            }
            if (objects.Count != 0)
            {
                throw new CompanionContractException(code);
            }
        }
        catch (JsonException)
        {
            throw new CompanionContractException(code);
        }
    }
}
