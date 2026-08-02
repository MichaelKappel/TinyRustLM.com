"""Build full-logit source evidence from a hash-bound raw-quality baseline.

The input baseline is produced by ``reference-raw-quality.py``. This tool does
not regenerate prompts or sample new answers: it reopens the exact checkpoint,
re-tokenizes each exact rendered prompt, verifies the earlier top-five logits,
and writes full float32 vectors for converter/runtime conformance comparison.
"""

from __future__ import annotations

import argparse
import array
import hashlib
import json
import math
import os
import shutil
import struct
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol, Sequence


BASELINE_SCHEMA = "tinyrustlm.reference_raw_quality.v4"
GOLDEN_SCHEMA = "tinyrustlm.reference_logit_golden.v1"
MAX_BASELINE_BYTES = 128 * 1024 * 1024
MAX_EVAL_BYTES = 16 * 1024 * 1024
MAX_RENDERED_PROMPT_BYTES = 4 * 1024 * 1024
MAX_CASES = 256
MAX_PROMPT_TOKENS = 65_536
MAX_LOGIT_COUNT = 2_000_000
MAX_GENERATION_AUTHORITY_BYTES = 1024 * 1024
REQUIRED_BASELINE_KEYS = {
    "schema",
    "source_model_id",
    "source_revision",
    "checkpoint",
    "checkpoint_artifacts",
    "adapter",
    "eval_cases",
    "eval_cases_sha256",
    "system_prompt_mode",
    "system_prompt",
    "policy_examples",
    "user_suffix",
    "chat_template_options",
    "loader_contract",
    "torch_compile_mode",
    "tokenizer_load_options",
    "model_load_options",
    "generation_contract",
    "generation_retries_allowed",
    "response_repairs_allowed",
    "field_assembly_allowed",
    "expected_answer_injection_allowed",
    "generation_profile",
    "generation_seed_base",
    "generation",
    "source_generation_config",
    "publisher_generation_override",
    "reference_framework",
    "torch_version",
    "transformers_version",
    "dtype",
    "device",
    "load_seconds",
    "case_count",
    "cases",
}
ALLOWED_BASELINE_KEYS = REQUIRED_BASELINE_KEYS
CASE_KEYS = {
    "index",
    "prompt",
    "history",
    "max_new_tokens",
    "required_answer_terms",
    "forbidden_answer_terms",
    "declarative_term_assessment",
    "generation_call_count",
    "output_transform",
    "seed",
    "rendered_prompt",
    "rendered_prompt_sha256",
    "prompt_token_ids",
    "prompt_token_sha256_le_u32",
    "output_token_ids",
    "output_token_sha256_le_u32",
    "raw_output_text",
    "first_step_top5",
    "elapsed_seconds",
}
TOP_LOGIT_KEYS = {"token_id", "logit", "token_text"}
ARTIFACT_KEYS = {"bytes", "sha256"}
ESSENTIAL_CHECKPOINT_ARTIFACTS = {
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
}
TOKENIZER_LOAD_OPTION_KEYS = {
    "local_files_only",
    "trust_remote_code",
    "fix_mistral_regex",
}
MODEL_LOAD_OPTION_KEYS = {"local_files_only", "trust_remote_code", "dtype"}


@dataclass(frozen=True)
class SourceCase:
    index: int
    prompt: str
    rendered_prompt: str
    prompt_token_ids: tuple[int, ...]
    first_step_top5: tuple[tuple[int, float], ...]


@dataclass(frozen=True)
class SourceBaseline:
    path: Path
    sha256: str
    checkpoint: Path
    value: dict[str, Any]
    cases: tuple[SourceCase, ...]


class LogitRunner(Protocol):
    metadata: dict[str, str]

    def compute(self, rendered_prompt: str) -> tuple[list[int], Sequence[float]]:
        """Return exact prompt token IDs and final-position logits."""


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def token_sha256(token_ids: Sequence[int]) -> str:
    return sha256_bytes(b"".join(struct.pack("<I", token_id) for token_id in token_ids))


def require_exact_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing or unknown:
        raise ValueError(f"{label} key mismatch; missing={missing}; unknown={unknown}")


def require_string(value: dict[str, Any], key: str, label: str) -> str:
    result = value.get(key)
    if (
        not isinstance(result, str)
        or not result
        or result.strip() != result
        or "\0" in result
    ):
        raise ValueError(f"{label}.{key} must be a non-empty trimmed string")
    return result


def require_integer(value: Any, label: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer")
    if value < minimum or value > maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}")
    return value


def require_sha256(value: Any, label: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or value != value.lower()
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ValueError(f"{label} must be 64 lowercase hexadecimal characters")
    return value


def read_json_object(path: Path, maximum_bytes: int, label: str) -> dict[str, Any]:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"{label} must be a regular non-symlink file: {path}")
    if path.stat().st_size > maximum_bytes:
        raise ValueError(f"{label} exceeds the maximum byte length")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} must be valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def safe_checkpoint_artifact(checkpoint: Path, name: str) -> Path:
    relative = Path(name)
    if relative.is_absolute() or not relative.parts or ".." in relative.parts:
        raise ValueError(f"checkpoint artifact path is unsafe: {name}")
    path = (checkpoint / relative).resolve()
    if not path.is_relative_to(checkpoint):
        raise ValueError(f"checkpoint artifact escapes the checkpoint: {name}")
    return path


def validate_publisher_generation_override(
    checkpoint: Path, raw_override: Any
) -> None:
    if raw_override is None:
        return
    if not isinstance(raw_override, dict):
        raise ValueError("publisher_generation_override must be an object or null")
    require_exact_keys(
        raw_override,
        {
            "authority_file",
            "authority_file_bytes",
            "authority_file_sha256",
            "eos_token_id",
        },
        "publisher_generation_override",
    )
    authority_name = require_string(
        raw_override,
        "authority_file",
        "publisher_generation_override",
    )
    if Path(authority_name).name != authority_name:
        raise ValueError("publisher generation authority must be in the checkpoint root")
    authority = safe_checkpoint_artifact(checkpoint, authority_name)
    if not authority.is_file() or authority.is_symlink():
        raise ValueError("publisher generation authority is missing or unsafe")
    authority_bytes = require_integer(
        raw_override.get("authority_file_bytes"),
        "publisher_generation_override.authority_file_bytes",
        1,
        MAX_GENERATION_AUTHORITY_BYTES,
    )
    if authority.stat().st_size != authority_bytes:
        raise ValueError("publisher generation authority byte length changed")
    expected_sha256 = require_sha256(
        raw_override.get("authority_file_sha256"),
        "publisher_generation_override.authority_file_sha256",
    )
    if sha256_file(authority) != expected_sha256:
        raise ValueError("publisher generation authority SHA-256 changed")
    eos_token_id = raw_override.get("eos_token_id")
    values = eos_token_id if isinstance(eos_token_id, list) else [eos_token_id]
    if (
        not 0 < len(values) <= 16
        or any(
            isinstance(token_id, bool)
            or not isinstance(token_id, int)
            or token_id < 0
            for token_id in values
        )
        or len(set(values)) != len(values)
    ):
        raise ValueError("publisher generation override EOS token IDs are invalid")


def validate_checkpoint_artifacts(
    checkpoint: Path, raw_artifacts: Any
) -> dict[str, dict[str, Any]]:
    if not isinstance(raw_artifacts, dict) or not raw_artifacts:
        raise ValueError("checkpoint_artifacts must be a non-empty object")
    if len(raw_artifacts) > 512:
        raise ValueError("checkpoint_artifacts exceeds the supported file count")
    missing_essential = sorted(ESSENTIAL_CHECKPOINT_ARTIFACTS - set(raw_artifacts))
    if missing_essential:
        raise ValueError(f"checkpoint_artifacts missing essentials: {missing_essential}")
    if not any(name.endswith(".safetensors") for name in raw_artifacts):
        raise ValueError("checkpoint_artifacts must bind at least one safetensors file")

    validated: dict[str, dict[str, Any]] = {}
    for name in sorted(raw_artifacts):
        identity = raw_artifacts[name]
        if not isinstance(name, str) or not name or "\0" in name:
            raise ValueError("checkpoint artifact names must be non-empty strings")
        if not isinstance(identity, dict):
            raise ValueError(f"checkpoint artifact identity must be an object: {name}")
        require_exact_keys(identity, ARTIFACT_KEYS, f"checkpoint artifact {name}")
        expected_bytes = require_integer(
            identity.get("bytes"), f"checkpoint artifact {name}.bytes", 1, 1 << 40
        )
        expected_sha256 = require_sha256(
            identity.get("sha256"), f"checkpoint artifact {name}.sha256"
        )
        path = safe_checkpoint_artifact(checkpoint, name)
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"checkpoint artifact is missing or not regular: {name}")
        if path.stat().st_size != expected_bytes:
            raise ValueError(f"checkpoint artifact byte length drift: {name}")
        if sha256_file(path) != expected_sha256:
            raise ValueError(f"checkpoint artifact SHA-256 drift: {name}")
        validated[name] = {"bytes": expected_bytes, "sha256": expected_sha256}
    return validated


def validate_token_ids(value: Any, label: str, allow_empty: bool) -> tuple[int, ...]:
    if not isinstance(value, list):
        raise ValueError(f"{label} must be an array")
    minimum = 0 if allow_empty else 1
    if len(value) < minimum or len(value) > MAX_PROMPT_TOKENS:
        raise ValueError(f"{label} has an unsupported token count")
    token_ids = tuple(
        require_integer(token_id, f"{label}[{index}]", 0, (1 << 32) - 1)
        for index, token_id in enumerate(value)
    )
    return token_ids


def validate_top5(value: Any, label: str) -> tuple[tuple[int, float], ...]:
    if not isinstance(value, list) or len(value) != 5:
        raise ValueError(f"{label} must contain exactly five entries")
    observed: list[tuple[int, float]] = []
    seen_tokens: set[int] = set()
    for index, item in enumerate(value):
        item_label = f"{label}[{index}]"
        if not isinstance(item, dict):
            raise ValueError(f"{item_label} must be an object")
        require_exact_keys(item, TOP_LOGIT_KEYS, item_label)
        token_id = require_integer(item.get("token_id"), f"{item_label}.token_id", 0, (1 << 32) - 1)
        logit = item.get("logit")
        if isinstance(logit, bool) or not isinstance(logit, (int, float)) or not math.isfinite(logit):
            raise ValueError(f"{item_label}.logit must be finite")
        token_text = item.get("token_text")
        if not isinstance(token_text, str) or "\0" in token_text:
            raise ValueError(f"{item_label}.token_text must be text without NUL")
        if token_id in seen_tokens:
            raise ValueError(f"{label} contains a duplicate token ID")
        if observed and float(logit) > observed[-1][1]:
            raise ValueError(f"{label} must be sorted by descending logit")
        seen_tokens.add(token_id)
        observed.append((token_id, float(logit)))
    return tuple(observed)


def load_source_baseline(baseline_path: Path, checkpoint_path: Path) -> SourceBaseline:
    path = baseline_path.resolve()
    checkpoint = checkpoint_path.resolve()
    if not checkpoint.is_dir() or checkpoint.is_symlink():
        raise ValueError(f"checkpoint must be a non-symlink directory: {checkpoint}")
    value = read_json_object(path, MAX_BASELINE_BYTES, "source baseline")
    missing = sorted(REQUIRED_BASELINE_KEYS - set(value))
    unknown = sorted(set(value) - ALLOWED_BASELINE_KEYS)
    if missing or unknown:
        raise ValueError(
            f"source baseline key mismatch; missing={missing}; unknown={unknown}"
        )
    if value.get("schema") != BASELINE_SCHEMA:
        raise ValueError("source baseline schema is unsupported")
    if value.get("loader_contract") != "local-files-no-remote-code-v1":
        raise ValueError("source baseline loader contract is unsupported")
    if value.get("torch_compile_mode") != "disabled-eager":
        raise ValueError("source baseline torch compile mode changed")
    tokenizer_load_options = value.get("tokenizer_load_options")
    if not isinstance(tokenizer_load_options, dict):
        raise ValueError("source baseline tokenizer load options must be an object")
    require_exact_keys(
        tokenizer_load_options,
        TOKENIZER_LOAD_OPTION_KEYS,
        "source baseline tokenizer load options",
    )
    if (
        tokenizer_load_options.get("local_files_only") is not True
        or tokenizer_load_options.get("trust_remote_code") is not False
        or not isinstance(tokenizer_load_options.get("fix_mistral_regex"), bool)
    ):
        raise ValueError("source baseline tokenizer load options changed")
    model_load_options = value.get("model_load_options")
    if not isinstance(model_load_options, dict):
        raise ValueError("source baseline model load options must be an object")
    require_exact_keys(
        model_load_options,
        MODEL_LOAD_OPTION_KEYS,
        "source baseline model load options",
    )
    if (
        model_load_options.get("local_files_only") is not True
        or model_load_options.get("trust_remote_code") is not False
        or model_load_options.get("dtype") != "float32"
    ):
        raise ValueError("source baseline model load options changed")
    require_string(value, "source_model_id", "source baseline")
    require_string(value, "source_revision", "source baseline")
    stored_checkpoint = Path(require_string(value, "checkpoint", "source baseline")).resolve()
    if stored_checkpoint != checkpoint:
        raise ValueError("source baseline checkpoint path does not match the selected checkpoint")
    validate_publisher_generation_override(
        checkpoint,
        value.get("publisher_generation_override"),
    )
    if value.get("adapter") is not None:
        raise ValueError("source logit golden must not be built from an adapter baseline")
    system_prompt_mode = value.get("system_prompt_mode")
    system_prompt = value.get("system_prompt")
    if system_prompt_mode == "included":
        if (
            not isinstance(system_prompt, str)
            or not system_prompt
            or system_prompt != system_prompt.strip()
            or "\0" in system_prompt
            or len(system_prompt.encode("utf-8")) > 16 * 1024
        ):
            raise ValueError("included source baseline system prompt is invalid")
    elif system_prompt_mode == "omitted-publisher-template":
        if system_prompt != "":
            raise ValueError("omitted source baseline system prompt must be empty")
    else:
        raise ValueError("source baseline system prompt mode is unsupported")
    if value.get("policy_examples") is not None or value.get("user_suffix") != "":
        raise ValueError("source logit golden requires an unaugmented source baseline")
    if (
        value.get("generation_contract") != "one-call-unmodified-v1"
        or value.get("generation_retries_allowed") is not False
        or value.get("response_repairs_allowed") is not False
        or value.get("field_assembly_allowed") is not False
        or value.get("expected_answer_injection_allowed") is not False
    ):
        raise ValueError("source baseline generation contract is not no-cheat compatible")
    if value.get("dtype") != "float32" or value.get("device") != "cpu":
        raise ValueError("source baseline must be float32 CPU evidence")
    validate_checkpoint_artifacts(checkpoint, value.get("checkpoint_artifacts"))

    eval_path = Path(require_string(value, "eval_cases", "source baseline")).resolve()
    if not eval_path.is_file() or eval_path.is_symlink():
        raise ValueError("source baseline eval fixture is missing or not a regular file")
    if eval_path.stat().st_size > MAX_EVAL_BYTES:
        raise ValueError("source baseline eval fixture exceeds the maximum byte length")
    expected_eval_sha256 = require_sha256(
        value.get("eval_cases_sha256"), "source baseline.eval_cases_sha256"
    )
    if sha256_file(eval_path) != expected_eval_sha256:
        raise ValueError("source baseline eval fixture SHA-256 drift")

    case_count = require_integer(
        value.get("case_count"), "source baseline.case_count", 1, MAX_CASES
    )
    raw_cases = value.get("cases")
    if not isinstance(raw_cases, list) or len(raw_cases) != case_count:
        raise ValueError("source baseline case coverage mismatch")
    cases: list[SourceCase] = []
    for expected_index, raw_case in enumerate(raw_cases):
        label = f"source baseline case {expected_index}"
        if not isinstance(raw_case, dict):
            raise ValueError(f"{label} must be an object")
        require_exact_keys(raw_case, CASE_KEYS, label)
        index = require_integer(raw_case.get("index"), f"{label}.index", 0, case_count - 1)
        if index != expected_index:
            raise ValueError("source baseline cases must have contiguous stable order")
        prompt = require_string(raw_case, "prompt", label)
        if not isinstance(raw_case.get("history"), list):
            raise ValueError(f"{label}.history must be an array")
        if not isinstance(raw_case.get("required_answer_terms"), list) or not isinstance(
            raw_case.get("forbidden_answer_terms"), list
        ):
            raise ValueError(f"{label} answer terms must be arrays")
        if not isinstance(raw_case.get("declarative_term_assessment"), dict):
            raise ValueError(f"{label}.declarative_term_assessment must be an object")
        if (
            raw_case.get("generation_call_count") != 1
            or raw_case.get("output_transform") != "none"
        ):
            raise ValueError(f"{label} was retried or transformed")
        rendered_prompt = raw_case.get("rendered_prompt")
        if not isinstance(rendered_prompt, str) or not rendered_prompt or "\0" in rendered_prompt:
            raise ValueError(f"{label}.rendered_prompt must be non-empty text")
        rendered_bytes = rendered_prompt.encode("utf-8")
        if len(rendered_bytes) > MAX_RENDERED_PROMPT_BYTES:
            raise ValueError(f"{label}.rendered_prompt exceeds the byte limit")
        rendered_sha256 = require_sha256(
            raw_case.get("rendered_prompt_sha256"), f"{label}.rendered_prompt_sha256"
        )
        if sha256_bytes(rendered_bytes) != rendered_sha256:
            raise ValueError(f"{label} rendered prompt SHA-256 drift")
        prompt_token_ids = validate_token_ids(
            raw_case.get("prompt_token_ids"), f"{label}.prompt_token_ids", False
        )
        if token_sha256(prompt_token_ids) != require_sha256(
            raw_case.get("prompt_token_sha256_le_u32"),
            f"{label}.prompt_token_sha256_le_u32",
        ):
            raise ValueError(f"{label} prompt token SHA-256 drift")
        output_token_ids = validate_token_ids(
            raw_case.get("output_token_ids"), f"{label}.output_token_ids", True
        )
        if token_sha256(output_token_ids) != require_sha256(
            raw_case.get("output_token_sha256_le_u32"),
            f"{label}.output_token_sha256_le_u32",
        ):
            raise ValueError(f"{label} output token SHA-256 drift")
        if not isinstance(raw_case.get("raw_output_text"), str):
            raise ValueError(f"{label}.raw_output_text must be text")
        top5 = validate_top5(raw_case.get("first_step_top5"), f"{label}.first_step_top5")
        cases.append(
            SourceCase(
                index=index,
                prompt=prompt,
                rendered_prompt=rendered_prompt,
                prompt_token_ids=prompt_token_ids,
                first_step_top5=top5,
            )
        )
    return SourceBaseline(
        path=path,
        sha256=sha256_file(path),
        checkpoint=checkpoint,
        value=value,
        cases=tuple(cases),
    )


def ranked_logits(logits: Sequence[float], count: int) -> list[tuple[int, float]]:
    return sorted(
        enumerate(logits), key=lambda item: (-float(item[1]), item[0])
    )[:count]


def verify_prior_top5(
    expected: Sequence[tuple[int, float]], observed: Sequence[tuple[int, float]]
) -> None:
    expected_tokens = [token_id for token_id, _logit in expected]
    observed_tokens = [token_id for token_id, _logit in observed]
    if observed_tokens != expected_tokens:
        raise ValueError(
            "recomputed source top-five token IDs drift from the bound baseline"
        )
    for index, ((_, expected_logit), (_, observed_logit)) in enumerate(
        zip(expected, observed, strict=True)
    ):
        tolerance = 1e-4 + abs(expected_logit) * 1e-5
        if abs(expected_logit - observed_logit) > tolerance:
            raise ValueError(
                f"recomputed source top-five logit {index} drifts from the bound baseline"
            )


def f32le_bytes(logits: Sequence[float]) -> bytes:
    if not logits or len(logits) > MAX_LOGIT_COUNT:
        raise ValueError("source logit vector has an unsupported length")
    if any(not math.isfinite(float(value)) for value in logits):
        raise ValueError("source logit vector contains a non-finite value")
    values = array.array("f", (float(value) for value in logits))
    if sys.byteorder != "little":
        values.byteswap()
    return values.tobytes()


def write_synced(path: Path, payload: bytes) -> None:
    with path.open("xb") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())


class TransformersLogitRunner:
    """Float32 CPU runner loaded only after every baseline binding passes."""

    def __init__(
        self,
        checkpoint: Path,
        tokenizer_load_options: dict[str, object],
        model_load_options: dict[str, object],
    ) -> None:
        os.environ["TORCHDYNAMO_DISABLE"] = "1"
        import torch
        import transformers
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self._torch = torch
        self._tokenizer = AutoTokenizer.from_pretrained(
            checkpoint,
            local_files_only=bool(tokenizer_load_options["local_files_only"]),
            trust_remote_code=bool(tokenizer_load_options["trust_remote_code"]),
            fix_mistral_regex=bool(tokenizer_load_options["fix_mistral_regex"]),
        )
        dtype_argument = (
            {"dtype": torch.float32}
            if int(transformers.__version__.split(".", 1)[0]) >= 5
            else {"torch_dtype": torch.float32}
        )
        self._model = AutoModelForCausalLM.from_pretrained(
            checkpoint,
            local_files_only=bool(model_load_options["local_files_only"]),
            trust_remote_code=bool(model_load_options["trust_remote_code"]),
            **dtype_argument,
        )
        self._model.eval()
        self.metadata = {
            "framework": "transformers.AutoModelForCausalLM.forward",
            "torch_version": torch.__version__,
            "transformers_version": transformers.__version__,
            "dtype": "float32",
            "device": "cpu",
        }

    def compute(self, rendered_prompt: str) -> tuple[list[int], Sequence[float]]:
        encoded = self._tokenizer(
            rendered_prompt,
            add_special_tokens=False,
            return_attention_mask=True,
            return_tensors="pt",
        )
        input_ids = encoded["input_ids"]
        attention_mask = encoded.get("attention_mask")
        if attention_mask is None:
            attention_mask = self._torch.ones_like(input_ids)
        with self._torch.inference_mode():
            logits = self._model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                use_cache=False,
            ).logits[0, -1, :]
        token_ids = [int(token_id) for token_id in input_ids[0].tolist()]
        values = logits.detach().to(device="cpu", dtype=self._torch.float32).tolist()
        return token_ids, values


def build_source_logit_golden(
    baseline_path: Path,
    checkpoint_path: Path,
    output_dir: Path,
    runner_factory: Callable[[Path], LogitRunner] | None = None,
) -> dict[str, Any]:
    output = output_dir.resolve()
    if output.exists():
        raise ValueError(f"output directory must not already exist: {output}")
    baseline = load_source_baseline(baseline_path, checkpoint_path)
    runner = (
        runner_factory(baseline.checkpoint)
        if runner_factory is not None
        else TransformersLogitRunner(
            baseline.checkpoint,
            baseline.value["tokenizer_load_options"],
            baseline.value["model_load_options"],
        )
    )
    if not isinstance(runner.metadata, dict) or any(
        not isinstance(key, str) or not isinstance(value, str)
        for key, value in runner.metadata.items()
    ):
        raise ValueError("logit runner metadata must be a string map")

    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output.name}.tmp-", dir=output.parent)
    )
    try:
        results: list[dict[str, Any]] = []
        for source_case in baseline.cases:
            observed_tokens, raw_logits = runner.compute(source_case.rendered_prompt)
            if tuple(observed_tokens) != source_case.prompt_token_ids:
                raise ValueError(
                    f"case {source_case.index} prompt token IDs drift from the bound baseline"
                )
            logits = [float(value) for value in raw_logits]
            payload = f32le_bytes(logits)
            top32 = ranked_logits(logits, 32)
            verify_prior_top5(source_case.first_step_top5, top32[:5])

            prompt_name = f"case-{source_case.index}.rendered-prompt.txt"
            logits_name = f"case-{source_case.index}.logits.f32le"
            rendered_bytes = source_case.rendered_prompt.encode("utf-8")
            write_synced(staging / prompt_name, rendered_bytes)
            write_synced(staging / logits_name, payload)
            results.append(
                {
                    "index": source_case.index,
                    "prompt": source_case.prompt,
                    "rendered_prompt_file": prompt_name,
                    "rendered_prompt_bytes": len(rendered_bytes),
                    "rendered_prompt_sha256": sha256_bytes(rendered_bytes),
                    "prompt_token_ids": list(source_case.prompt_token_ids),
                    "prompt_token_sha256_le_u32": token_sha256(
                        source_case.prompt_token_ids
                    ),
                    "logits_file": logits_name,
                    "logits_encoding": "f32-little-endian",
                    "logit_count": len(logits),
                    "logits_sha256": sha256_bytes(payload),
                    "argmax_token_id": top32[0][0],
                    "first_step_top32": [
                        {"token_id": token_id, "logit": logit}
                        for token_id, logit in top32
                    ],
                }
            )

        report = {
            "schema": GOLDEN_SCHEMA,
            "purpose": "source-to-converter-runtime-full-logit-conformance",
            "source_baseline": str(baseline.path),
            "source_baseline_sha256": baseline.sha256,
            "source_model_id": baseline.value["source_model_id"],
            "source_revision": baseline.value["source_revision"],
            "checkpoint": str(baseline.checkpoint),
            "checkpoint_artifacts": baseline.value["checkpoint_artifacts"],
            "eval_cases_path": baseline.value["eval_cases"],
            "eval_cases_sha256": baseline.value["eval_cases_sha256"],
            "system_prompt_mode": baseline.value["system_prompt_mode"],
            "system_prompt": baseline.value["system_prompt"],
            "chat_template_options": baseline.value["chat_template_options"],
            "loader_contract": baseline.value["loader_contract"],
            "torch_compile_mode": baseline.value["torch_compile_mode"],
            "tokenizer_load_options": baseline.value["tokenizer_load_options"],
            "model_load_options": baseline.value["model_load_options"],
            "baseline_reference_framework": baseline.value["reference_framework"],
            "runner": dict(sorted(runner.metadata.items())),
            "case_count": len(results),
            "cases": results,
            "contains_training_approval": False,
            "training_authority": False,
            "required_next_gate": "compare-native-slm-logit-probes",
        }
        write_synced(
            staging / "reference-golden.json",
            (json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n").encode(
                "utf-8"
            ),
        )
        os.replace(staging, output)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build full-logit evidence from a bound source raw-quality baseline."
    )
    parser.add_argument("baseline", type=Path)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("output_dir", type=Path)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    report = build_source_logit_golden(
        args.baseline, args.checkpoint, args.output_dir
    )
    print("TinyRustLM source full-logit golden: PASS")
    print(f"source_model_id: {report['source_model_id']}")
    print(f"cases: {report['case_count']}")
    print(f"output_dir: {args.output_dir.resolve()}")
    print("training_authority: false")


if __name__ == "__main__":
    main()
