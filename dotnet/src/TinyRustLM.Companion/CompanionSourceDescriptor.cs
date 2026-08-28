namespace TinyRustLM.Companion;

/// <summary>The sole built-in source closure admitted by the current prelaunch product.</summary>
internal static class CompanionSourceDescriptor
{
    internal const string DescriptorId = "tinyrustlm.source.qwen3-0.6b-c1899de/1";
    internal const string ModelId = "qwen3-0.6b";
    internal const string Repository = "Qwen/Qwen3-0.6B";
    internal const string Revision = "c1899de289a04d12100db370d81485cdf75e47ca";
    internal const string ModelSourceLockSha256 =
        "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d";
    internal const string TokenizerSourceLockSha256 =
        "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70";
    internal const string CompositionProfileSha256 =
        "19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8";
    internal const string PayloadInventorySchema =
        "tinyrustlm.source-payload-inventory.v1";
    internal const string PayloadInventorySha256 =
        "59e57ba08d4dc6e0914f6089f3321c073739ed60a506edd533068d8d0d2b2da9";
    internal const string CacheLogicalId =
        "sha256:e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d";
    internal const string InitialOrigin = "https://huggingface.co";
    internal const string NetworkProfileId = "tinyrustlm.source-network/1";
    internal const string ResourcePolicyId = "tinyrustlm.companion-resource/1";
    internal const uint FileCount = 9;
    internal const uint MaximumRedirects = 8;
    internal const uint BufferBytes = 1_048_576;
    internal const ulong PayloadBytes = 1_519_207_688;

    internal static void RequireSupported(CompanionAcquireRequest request)
    {
        if (request.ModelId != ModelId ||
            request.SourceRepository != Repository ||
            request.SourceRevision != Revision ||
            request.ModelSourceLockSha256 != ModelSourceLockSha256 ||
            request.TokenizerSourceLockSha256 != TokenizerSourceLockSha256 ||
            request.CompositionProfileSha256 != CompositionProfileSha256 ||
            request.MaximumSourceBytes != PayloadBytes)
        {
            throw new CompanionContractException("acquire-source-unsupported");
        }
    }
}
