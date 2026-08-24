namespace TinyRustLM;

internal static class NativeReportValidation
{
    internal static void RequireSchema(string actual, string expected)
    {
        if (!string.Equals(actual, expected, StringComparison.Ordinal))
        {
            throw new TinyRustLmException("native-report-schema");
        }
    }

    internal static TinyRustLmRuntimeState RuntimeState(TinyRustLmRuntimeState state)
    {
        if (state is null)
        {
            throw new TinyRustLmException("native-runtime-state-report");
        }

        RequireSchema(state.Schema, "tinyrustlm.native.runtime_state/1");
        if (!ManagedValidation.IsOperationId(state.OperationId))
        {
            throw new TinyRustLmException("native-runtime-state-report");
        }

        var active = state.State is "active-idle" or "generating" or "terminal-output-ready";
        if (state.State is not ("empty" or "active-idle" or "generating" or "terminal-output-ready") ||
            active != (state.ActiveComposition is not null) ||
            active != (state.MemoryPlan is not null) ||
            (!active && state.CommittedKvBytes != 0))
        {
            throw new TinyRustLmException("native-runtime-state-report");
        }

        if (state.ActiveComposition is not null)
        {
            Composition(state.ActiveComposition);
        }

        if (state.MemoryPlan is { } memoryPlan &&
            (memoryPlan.ModelBytes == 0 || memoryPlan.KvBytes == 0 || memoryPlan.ScratchBytes == 0))
        {
            throw new TinyRustLmException("native-memory-plan-report");
        }

        return state;
    }

    internal static TinyRustLmRuntimeStep RuntimeStep(TinyRustLmRuntimeStep step)
    {
        if (step is null)
        {
            throw new TinyRustLmException("native-runtime-step-report");
        }

        RequireSchema(step.Schema, "tinyrustlm.native.runtime_step/1");
        Status(step.Status);
        if (step.Status.Kind == "active" &&
            (step.SelectedTokenId is null || step.EmittedTokenId is null))
        {
            throw new TinyRustLmException("native-runtime-step-report");
        }

        return step;
    }

    internal static TinyRustLmRuntimeOutput RuntimeOutput(TinyRustLmRuntimeOutput output)
    {
        if (output is null)
        {
            throw new TinyRustLmException("native-runtime-output-report");
        }

        RequireSchema(output.Schema, "tinyrustlm.native.runtime_output/1");
        if (!ManagedValidation.IsOperationId(output.OperationId))
        {
            throw new TinyRustLmException("native-runtime-output-report");
        }

        Status(output.Status);
        Composition(output.Composition);
        if (output.Status.Kind == "active" || output.TokenIds is null)
        {
            throw new TinyRustLmException("native-runtime-output-report");
        }

        return output;
    }

    internal static Slm2Inspection Slm2Inspection(Slm2Inspection inspection)
    {
        if (inspection is null ||
            inspection.FormatProfile != "org.minimodel.slm2/2.0" ||
            inspection.WeightProfile != "tinyrustlm.weight-q8-row-symmetric-f32-scale/1" ||
            inspection.ArtifactBytes == 0 ||
            inspection.TensorCount == 0 ||
            inspection.Model is null ||
            !ManagedValidation.IsDigest(inspection.FormatProfileSha256) ||
            !ManagedValidation.IsDigest(inspection.WeightProfileSha256) ||
            !ManagedValidation.IsDigest(inspection.ArtifactSha256) ||
            !ManagedValidation.IsDigest(inspection.ManifestSha256) ||
            !ManagedValidation.IsDigest(inspection.TensorLayoutSha256))
        {
            throw new TinyRustLmException("native-slm2-report");
        }
        if (inspection.Model.VocabularySize == 0 ||
            inspection.Model.ContextLength == 0 ||
            inspection.Model.EmbeddingSize == 0 ||
            inspection.Model.LayerCount == 0 ||
            inspection.Model.HeadCount == 0 ||
            inspection.Model.KvHeadCount == 0 ||
            inspection.Model.HeadDimension == 0 ||
            !float.IsFinite(inspection.Model.RopeTheta) ||
            !float.IsFinite(inspection.Model.NormalizationEpsilon))
        {
            throw new TinyRustLmException("native-slm2-model-report");
        }

        return inspection;
    }

    private static void Composition(TinyRustLmCompositionIdentity composition)
    {
        if (composition is null ||
            composition.ArtifactBytes != 896 ||
            !ManagedValidation.IsDigest(composition.ArtifactSha256) ||
            !ManagedValidation.IsDigest(composition.GraphIdentitySha256) ||
            !ManagedValidation.IsDigest(composition.MemberTableSha256))
        {
            throw new TinyRustLmException("native-composition-report");
        }
    }

    private static void Status(TinyRustLmGenerationStatus status)
    {
        if (status is null)
        {
            throw new TinyRustLmException("native-generation-status-report");
        }

        var valid = status.Kind switch
        {
            "active" => status.StopTokenId is null,
            "stop-token" => status.StopTokenId is not null,
            "maximum-new-tokens" or "context-limit" or "cancelled" => status.StopTokenId is null,
            _ => false
        };
        if (!valid)
        {
            throw new TinyRustLmException("native-generation-status-report");
        }
    }
}
