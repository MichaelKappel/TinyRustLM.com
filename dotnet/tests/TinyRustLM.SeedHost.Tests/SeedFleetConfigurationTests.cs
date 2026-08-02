using System.Text.Json;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedFleetConfigurationTests
{
    [Fact]
    public void CanonicalJsonIsDeterministicAcrossInputOrdering()
    {
        var modelA = Model("tinyrustlm/model-a", "a");
        var modelB = Model("tinyrustlm/model-b", "b");
        var left = SeedFleetConfiguration.Create(
            "test-fleet",
            [modelB, modelA],
            [Lane("seed-b", modelB, modelA), Lane("seed-a", modelB, modelA)]);
        var right = SeedFleetConfiguration.Create(
            "test-fleet",
            [modelA, modelB],
            [Lane("seed-a", modelA, modelB), Lane("seed-b", modelA, modelB)]);

        Assert.Equal(left.ToCanonicalJson(), right.ToCanonicalJson());
        using var document = JsonDocument.Parse(left.ToCanonicalJson());
        Assert.Equal("minimodel.seed_fleet", document.RootElement.GetProperty("fleet_kind").GetString());
        Assert.Equal(20, document.RootElement.GetProperty("target_model_count").GetInt32());
        Assert.Equal(2, document.RootElement.GetProperty("replica_lane_count").GetInt32());
        Assert.True(document.RootElement
            .GetProperty("boundary")
            .GetProperty("advertise_only_after_external_probe")
            .GetBoolean());
    }

    [Fact]
    public void EmptyFleetIsValidButDuplicateModelsAndArtifactsFailClosed()
    {
        var empty = SeedFleetConfiguration.Create(
            "empty-fleet",
            [],
            [new SeedFleetLane("seed-a", []), new SeedFleetLane("seed-b", [])]);
        Assert.Empty(empty.Models);

        var model = Model("tinyrustlm/model-a", "a");
        var duplicateModel = Assert.Throws<SeedHostValidationException>(() =>
            SeedFleetConfiguration.Create(
                "duplicate-model",
                [model, model],
                [Lane("seed-a", model), Lane("seed-b", model)]));
        Assert.Equal("duplicate_model_id", duplicateModel.Code);

        var duplicateArtifact = Assert.Throws<SeedHostValidationException>(() =>
            SeedFleetConfiguration.Create(
                "duplicate-artifact",
                [model, Model("tinyrustlm/model-b", "a")],
                [
                    Lane("seed-a", model, Model("tinyrustlm/model-b", "a")),
                    Lane("seed-b", model, Model("tinyrustlm/model-b", "a"))
                ]));
        Assert.Equal("duplicate_artifact_identity", duplicateArtifact.Code);
    }

    [Fact]
    public void DisabledModelRemainsAdmittedInCanonicalJson()
    {
        var model = Model("tinyrustlm/model-a", "a") with { Enabled = false };
        var configuration = SeedFleetConfiguration.Create(
            "disabled-fleet",
            [model],
            [Lane("seed-a", model), Lane("seed-b", model)]);

        var json = configuration.ToCanonicalJson();
        Assert.Contains("\"enabled\": false", json, StringComparison.Ordinal);
        Assert.Single(configuration.Models);
    }

    private static SeedFleetModel Model(string id, string stem) => new(
        id,
        Enabled: true,
        ManifestPath: $"shares/{stem}/{stem}.minimodel.manifest.v0",
        PieceDirectory: $"shares/{stem}/{stem}.peer-pieces",
        ArtifactSha256: $"sha256:{new string(stem[0], 64)}");

    private static SeedFleetLane Lane(string laneId, params SeedFleetModel[] models) => new(
        laneId,
        models.Select(model =>
        {
            var modelOffset = model.ModelId.EndsWith("model-a", StringComparison.Ordinal) ? 0 : 1;
            var port = 18000 + (laneId == "seed-a" ? 0 : 100) + modelOffset;
            return new SeedFleetEndpoint(
                model.ModelId,
                $"states/{laneId}-{modelOffset}.json",
                $"127.0.0.1:{port}",
                $"http://127.0.0.1:{port}/models/{modelOffset}/");
        }).ToArray());
}
