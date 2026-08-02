"""Compare TinyRustLM raw-prefill vectors with a source-framework golden pack."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def parse_manifest(path: Path) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"manifest line {line_number} is missing '='")
        key, value = line.split("=", 1)
        if not key or not value or key in fields:
            raise ValueError(f"manifest line {line_number} is empty or duplicated")
        fields[key] = value
    return fields


def read_f32le(path: Path, expected_count: int, expected_sha256: str | None) -> list[float]:
    payload = path.read_bytes()
    if len(payload) != expected_count * 4:
        raise ValueError(
            f"{path} has {len(payload)} bytes, expected {expected_count * 4}"
        )
    actual_sha256 = hashlib.sha256(payload).hexdigest()
    if expected_sha256 is not None and actual_sha256 != expected_sha256:
        raise ValueError(f"{path} SHA-256 does not match the golden manifest")
    values = [value[0] for value in struct.iter_unpack("<f", payload)]
    if any(not math.isfinite(value) for value in values):
        raise ValueError(f"{path} contains a non-finite value")
    return values


def top_indices(values: list[float], count: int) -> list[int]:
    return sorted(range(len(values)), key=lambda index: (-values[index], index))[:count]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = math.fsum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(math.fsum(value * value for value in left))
    right_norm = math.sqrt(math.fsum(value * value for value in right))
    if left_norm == 0.0 or right_norm == 0.0:
        raise ValueError("cosine similarity is undefined for a zero vector")
    return dot / (left_norm * right_norm)


def softmax(values: list[float]) -> list[float]:
    maximum = max(values)
    exponents = [math.exp(value - maximum) for value in values]
    total = math.fsum(exponents)
    return [value / total for value in exponents]


def jensen_shannon_divergence(left: list[float], right: list[float]) -> float:
    left_probabilities = softmax(left)
    right_probabilities = softmax(right)
    divergence = 0.0
    for left_value, right_value in zip(left_probabilities, right_probabilities):
        midpoint = (left_value + right_value) * 0.5
        if left_value > 0.0:
            divergence += 0.5 * left_value * math.log(left_value / midpoint)
        if right_value > 0.0:
            divergence += 0.5 * right_value * math.log(right_value / midpoint)
    return divergence


def compare_vectors(reference: list[float], candidate: list[float]) -> dict[str, object]:
    if len(reference) != len(candidate):
        raise ValueError("reference and candidate vector lengths differ")
    reference_mean = math.fsum(reference) / len(reference)
    candidate_mean = math.fsum(candidate) / len(candidate)
    centered_reference = [value - reference_mean for value in reference]
    centered_candidate = [value - candidate_mean for value in candidate]
    differences = [left - right for left, right in zip(reference, candidate)]
    centered_differences = [
        left - right for left, right in zip(centered_reference, centered_candidate)
    ]
    reference_range = max(reference) - min(reference)
    reference_top5 = top_indices(reference, 5)
    candidate_top5 = top_indices(candidate, 5)
    reference_top32 = top_indices(reference, 32)
    candidate_top32 = top_indices(candidate, 32)
    return {
        "logit_count": len(reference),
        "reference_argmax_token_id": top_indices(reference, 1)[0],
        "candidate_argmax_token_id": top_indices(candidate, 1)[0],
        "top1_match": top_indices(reference, 1)[0] == top_indices(candidate, 1)[0],
        "top5_overlap_count": len(set(reference_top5) & set(candidate_top5)),
        "top5_overlap_fraction": len(set(reference_top5) & set(candidate_top5)) / 5.0,
        "top32_overlap_count": len(set(reference_top32) & set(candidate_top32)),
        "top32_overlap_fraction": len(set(reference_top32) & set(candidate_top32)) / 32.0,
        "cosine_similarity": cosine_similarity(reference, candidate),
        "centered_cosine_similarity": cosine_similarity(
            centered_reference, centered_candidate
        ),
        "max_abs_diff": max(abs(value) for value in differences),
        "centered_max_abs_diff": max(abs(value) for value in centered_differences),
        "range_normalized_centered_max_abs_diff": (
            max(abs(value) for value in centered_differences) / reference_range
            if reference_range > 0.0
            else 0.0
        ),
        "rmse": math.sqrt(
            math.fsum(value * value for value in differences) / len(differences)
        ),
        "centered_rmse": math.sqrt(
            math.fsum(value * value for value in centered_differences)
            / len(centered_differences)
        ),
        "mean_shift": candidate_mean - reference_mean,
        "jensen_shannon_divergence_nats": jensen_shannon_divergence(
            reference, candidate
        ),
        "reference_top5_token_ids": reference_top5,
        "candidate_top5_token_ids": candidate_top5,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference_dir", type=Path)
    parser.add_argument("probe_dir", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    reference_dir = args.reference_dir.resolve()
    probe_dir = args.probe_dir.resolve()
    golden_path = reference_dir / "reference-golden.json"
    probe_manifest_path = probe_dir / "probe.manifest"
    golden = json.loads(golden_path.read_text(encoding="utf-8"))
    probe = parse_manifest(probe_manifest_path)
    if golden.get("schema") != "tinyrustlm.reference_logit_golden.v1":
        raise ValueError("unsupported reference golden schema")
    if probe.get("tinyrustlm_logit_probe_version") != "1":
        raise ValueError("unsupported TinyRustLM probe schema")
    case_count = int(probe["case_count"])
    if case_count != int(golden["case_count"]):
        raise ValueError("reference and probe case counts differ")

    results: list[dict[str, object]] = []
    for index, golden_case in enumerate(golden["cases"]):
        prefix = f"case.{index}"
        golden_tokens = [int(value) for value in golden_case["prompt_token_ids"]]
        probe_tokens = [int(value) for value in probe[f"{prefix}.token_ids"].split(",")]
        if probe_tokens != golden_tokens:
            raise ValueError(f"case {index} prompt token IDs differ")
        logit_count = int(golden_case["logit_count"])
        if int(probe[f"{prefix}.logit_count"]) != logit_count:
            raise ValueError(f"case {index} logit count differs")
        reference_path = reference_dir / str(golden_case["logits_file"])
        candidate_path = probe_dir / probe[f"{prefix}.logits_file"]
        reference = read_f32le(
            reference_path,
            logit_count,
            str(golden_case["logits_sha256"]),
        )
        candidate = read_f32le(candidate_path, logit_count, None)
        metrics = compare_vectors(reference, candidate)
        metrics.update(
            {
                "index": index,
                "prompt": golden_case["prompt"],
                "prompt_token_ids_match": True,
                "reference_logits_sha256": golden_case["logits_sha256"],
                "candidate_logits_sha256": sha256_file(candidate_path),
            }
        )
        results.append(metrics)

    report = {
        "schema": "tinyrustlm.logit_conformance.v1",
        "reference_golden": str(golden_path),
        "reference_golden_sha256": sha256_file(golden_path),
        "probe_manifest": str(probe_manifest_path),
        "probe_manifest_sha256": sha256_file(probe_manifest_path),
        "model_path": probe["model_path"],
        "model_bytes": int(probe["model_bytes"]),
        "case_count": case_count,
        "top1_matches": sum(1 for result in results if result["top1_match"]),
        "minimum_cosine_similarity": min(
            float(result["cosine_similarity"]) for result in results
        ),
        "minimum_centered_cosine_similarity": min(
            float(result["centered_cosine_similarity"]) for result in results
        ),
        "maximum_centered_max_abs_diff": max(
            float(result["centered_max_abs_diff"]) for result in results
        ),
        "maximum_range_normalized_centered_max_abs_diff": max(
            float(result["range_normalized_centered_max_abs_diff"])
            for result in results
        ),
        "minimum_top5_overlap_fraction": min(
            float(result["top5_overlap_fraction"]) for result in results
        ),
        "cases": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
