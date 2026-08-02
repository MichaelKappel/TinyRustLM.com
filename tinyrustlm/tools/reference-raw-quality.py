"""Capture one-call raw quality evidence from a pinned local source checkpoint."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import time
from pathlib import Path

DEFAULT_SYSTEM_PROMPT = (
    "You are TinyRustLM, a browser-local AI assistant. "
    "You do not have personal experiences. Answer directly and helpfully."
)
REPORT_SCHEMA = "tinyrustlm.reference_raw_quality.v4"
REQUIRED_PROVENANCE_FILES = (
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
)
OPTIONAL_PROVENANCE_FILES = (
    "generation_config.json",
    "special_tokens_map.json",
    "added_tokens.json",
    "merges.txt",
    "vocab.json",
    "tokenizer.model",
    "chat_template.jinja",
)
POLICY_EXAMPLE_KEYS = {"id", "user", "assistant"}
MAX_POLICY_EXAMPLES = 8
MAX_POLICY_FILE_BYTES = 64 * 1024
MAX_POLICY_MESSAGE_BYTES = 4 * 1024
MAX_EVAL_HISTORY_TURNS = 6
STRICT_CONVERSATION_POLICY = "one-call-conversation-quality-v1"
MAX_ANSWER_TERMS = 16
MAX_ANSWER_TERM_CHARACTERS = 128
MAX_EOS_TOKEN_IDS = 16
MAX_GENERATION_AUTHORITY_BYTES = 1024 * 1024


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def token_sha256(token_ids: list[int]) -> str:
    payload = b"".join(struct.pack("<I", token_id) for token_id in token_ids)
    return sha256_bytes(payload)


def finite_topk(scores: object, torch_module: object, limit: int = 5) -> tuple[object, object]:
    if limit <= 0:
        raise ValueError("finite top-k limit must be positive")
    if getattr(scores, "ndim", None) != 1:
        raise ValueError("finite top-k scores must be one-dimensional")
    finite_indexes = torch_module.nonzero(
        torch_module.isfinite(scores), as_tuple=False
    ).flatten()
    count = min(limit, int(finite_indexes.numel()))
    if count == 0:
        raise ValueError("generation produced no finite first-step logits")
    finite_scores = scores.index_select(0, finite_indexes)
    top_values, local_indexes = torch_module.topk(finite_scores, count)
    return top_values, finite_indexes.index_select(0, local_indexes)


def serialize_report(report: dict[str, object]) -> str:
    try:
        return json.dumps(
            report,
            indent=2,
            ensure_ascii=False,
            allow_nan=False,
        ) + "\n"
    except ValueError as error:
        raise ValueError("raw quality report is not JSON compliant") from error


def one_call_generation_contract() -> dict[str, object]:
    return {
        "generation_contract": "one-call-unmodified-v1",
        "generation_retries_allowed": False,
        "response_repairs_allowed": False,
        "field_assembly_allowed": False,
        "expected_answer_injection_allowed": False,
    }


def local_loader_contract(fix_mistral_regex: bool) -> dict[str, object]:
    return {
        "loader_contract": "local-files-no-remote-code-v1",
        "torch_compile_mode": "disabled-eager",
        "tokenizer_load_options": {
            "local_files_only": True,
            "trust_remote_code": False,
            "fix_mistral_regex": fix_mistral_regex,
        },
        "model_load_options": {
            "local_files_only": True,
            "trust_remote_code": False,
            "dtype": "float32",
        },
    }


def resolve_system_prompt(mode: str, explicit_prompt: str | None) -> str:
    if mode == "included":
        prompt = DEFAULT_SYSTEM_PROMPT if explicit_prompt is None else explicit_prompt
        if (
            not prompt
            or prompt != prompt.strip()
            or "\0" in prompt
            or len(prompt.encode("utf-8")) > 16 * 1024
        ):
            raise ValueError(
                "included system prompt must be trimmed, NUL-free, and at most 16 KiB"
            )
        return prompt
    if mode == "omitted-publisher-template":
        if explicit_prompt is not None:
            raise ValueError(
                "an explicit system prompt cannot be supplied when the publisher "
                "template omits the system role"
            )
        return ""
    raise ValueError("unsupported system prompt mode")


def thinking_template_options(
    disable_thinking: bool,
    template_argument: str,
) -> dict[str, bool]:
    if template_argument not in {"enable_thinking", "thinking"}:
        raise ValueError("unsupported thinking chat-template argument")
    return {template_argument: False} if disable_thinking else {}


def parse_answer_terms(value: str | None, key: str) -> tuple[str, ...]:
    if value is None:
        return ()
    terms: list[str] = []
    for raw_term in value.split(","):
        term = " ".join(raw_term.split())
        if not term:
            raise ValueError(f"{key} contains an empty term")
        if len(term) > MAX_ANSWER_TERM_CHARACTERS:
            raise ValueError(
                f"{key} contains a term above {MAX_ANSWER_TERM_CHARACTERS} characters"
            )
        if any(delimiter in term for delimiter in "<>[]"):
            raise ValueError(f"{key} terms must not contain prompt-template delimiters")
        normalized = term.lower()
        if normalized in terms:
            raise ValueError(f"{key} contains a duplicate term")
        terms.append(normalized)
    if len(terms) > MAX_ANSWER_TERMS:
        raise ValueError(f"{key} contains more than {MAX_ANSWER_TERMS} terms")
    return tuple(terms)


def assess_answer_terms(
    answer: str,
    required_terms: tuple[str, ...],
    forbidden_terms: tuple[str, ...],
) -> dict[str, object]:
    normalized = answer.lower()
    missing = [term for term in required_terms if term not in normalized]
    matched_forbidden = [term for term in forbidden_terms if term in normalized]
    return {
        "status": "pass" if not missing and not matched_forbidden else "fail",
        "missing_required_terms": missing,
        "matched_forbidden_terms": matched_forbidden,
    }


def parse_eval_cases(path: Path) -> list[dict[str, object]]:
    fields: dict[str, str] = {}
    for line_number, raw_line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), 1
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"eval case line {line_number} is missing '='")
        key, value = line.split("=", 1)
        if not key or not value:
            raise ValueError(f"eval case line {line_number} has an empty key or value")
        if key in fields:
            raise ValueError(f"eval case line {line_number} duplicates {key!r}")
        fields[key] = value

    if fields.get("tinyrustlm_eval_cases_version") != "1":
        raise ValueError("eval fixture must use tinyrustlm_eval_cases_version=1")
    case_count = int(fields["case_count"])
    if case_count <= 0:
        raise ValueError("eval fixture must contain at least one case")
    quality_gate_policy = fields.get("quality_gate_policy", "")

    cases: list[dict[str, object]] = []
    for index in range(case_count):
        prompt = fields[f"case.{index}.prompt"]
        max_new_tokens = int(fields[f"case.{index}.max_new_tokens"])
        if max_new_tokens <= 0:
            raise ValueError(f"case {index} max_new_tokens must be positive")
        required_answer_terms = parse_answer_terms(
            fields.get(f"case.{index}.required_answer_terms"),
            f"case.{index}.required_answer_terms",
        )
        forbidden_answer_terms = parse_answer_terms(
            fields.get(f"case.{index}.forbidden_answer_terms"),
            f"case.{index}.forbidden_answer_terms",
        )
        history_turn_count = int(fields.get(f"case.{index}.history_turn_count", "0"))
        if history_turn_count < 0:
            raise ValueError(f"case {index} history_turn_count cannot be negative")
        if history_turn_count > MAX_EVAL_HISTORY_TURNS:
            raise ValueError(
                f"case {index} history_turn_count must be at most "
                f"{MAX_EVAL_HISTORY_TURNS}"
            )
        if history_turn_count and quality_gate_policy != STRICT_CONVERSATION_POLICY:
            raise ValueError(
                f"case {index} history is only allowed for "
                f"{STRICT_CONVERSATION_POLICY}"
            )
        history: list[dict[str, str]] = []
        for turn_index in range(history_turn_count):
            user_key = f"case.{index}.history.{turn_index}.user"
            assistant_key = f"case.{index}.history.{turn_index}.assistant"
            if user_key not in fields:
                raise ValueError(f"eval fixture is missing {user_key}")
            if assistant_key not in fields:
                raise ValueError(f"eval fixture is missing {assistant_key}")
            history.append(
                {
                    "user": fields[user_key],
                    "assistant": fields[assistant_key],
                }
            )
        cases.append(
            {
                "index": index,
                "prompt": prompt,
                "max_new_tokens": max_new_tokens,
                "history": tuple(history),
                "required_answer_terms": required_answer_terms,
                "forbidden_answer_terms": forbidden_answer_terms,
            }
        )
    return cases


def parse_policy_examples(path: Path) -> tuple[dict[str, str], ...]:
    if not path.is_file() or path.is_symlink():
        raise FileNotFoundError(f"policy examples file is missing or unsafe: {path}")
    payload = path.read_bytes()
    if not payload or len(payload) > MAX_POLICY_FILE_BYTES:
        raise ValueError("policy examples file is empty or too large")
    try:
        lines = payload.decode("utf-8").splitlines()
    except UnicodeDecodeError as error:
        raise ValueError("policy examples file must be UTF-8") from error

    examples: list[dict[str, str]] = []
    seen_ids = set()
    for line_number, raw_line in enumerate(lines, 1):
        if not raw_line.strip():
            continue
        try:
            value = json.loads(raw_line)
        except json.JSONDecodeError as error:
            raise ValueError(
                f"policy examples line {line_number} is invalid JSON"
            ) from error
        if not isinstance(value, dict) or set(value) != POLICY_EXAMPLE_KEYS:
            raise ValueError(
                f"policy examples line {line_number} has unsupported keys"
            )
        record_id = value["id"]
        if (
            not isinstance(record_id, str)
            or not record_id
            or any(
                not (character.isascii() and (character.isalnum() or character == "-"))
                for character in record_id
            )
        ):
            raise ValueError(f"policy examples line {line_number} has an invalid id")
        if record_id in seen_ids:
            raise ValueError("policy examples contain a duplicate id")
        seen_ids.add(record_id)
        for field in ("user", "assistant"):
            message = value[field]
            if (
                not isinstance(message, str)
                or not message.strip()
                or message != message.strip()
                or "\0" in message
                or len(message.encode("utf-8")) > MAX_POLICY_MESSAGE_BYTES
            ):
                raise ValueError(
                    f"policy examples line {line_number} has an invalid {field} message"
                )
        examples.append(
            {
                "id": record_id,
                "user": value["user"],
                "assistant": value["assistant"],
            }
        )
    if not examples or len(examples) > MAX_POLICY_EXAMPLES:
        raise ValueError("policy examples must contain between one and eight records")
    return tuple(examples)


def conversation_messages(
    system_prompt: str,
    policy_examples: tuple[dict[str, str], ...],
    prompt: str,
    user_suffix: str = "",
    history: tuple[dict[str, str], ...] = (),
) -> tuple[dict[str, str], ...]:
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    for example in policy_examples:
        messages.extend(
            (
                {"role": "user", "content": example["user"]},
                {"role": "assistant", "content": example["assistant"]},
            )
        )
    for turn in history:
        messages.extend(
            (
                {"role": "user", "content": turn["user"]},
                {"role": "assistant", "content": turn["assistant"]},
            )
        )
    current_prompt = f"{prompt}\n\n{user_suffix}" if user_suffix else prompt
    messages.append({"role": "user", "content": current_prompt})
    return tuple(messages)


def safe_checkpoint_file(checkpoint: Path, relative: str, label: str) -> Path:
    relative_path = Path(relative)
    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError(f"{label} must be a safe relative path")
    path = checkpoint / relative_path
    if (
        not path.is_file()
        or path.is_symlink()
        or not path.resolve().is_relative_to(checkpoint)
    ):
        raise FileNotFoundError(f"{label} is missing or unsafe: {path}")
    return path


def checkpoint_provenance(checkpoint: Path) -> dict[str, dict[str, object]]:
    checkpoint = checkpoint.resolve()
    artifacts: dict[str, dict[str, object]] = {}
    for name in REQUIRED_PROVENANCE_FILES:
        path = safe_checkpoint_file(checkpoint, name, "required checkpoint file")
        artifacts[name] = {
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }

    direct_weights = checkpoint / "model.safetensors"
    index_path = checkpoint / "model.safetensors.index.json"
    if direct_weights.is_file() and index_path.is_file():
        raise ValueError("checkpoint has ambiguous direct and indexed model weights")
    if direct_weights.is_file():
        path = safe_checkpoint_file(
            checkpoint, "model.safetensors", "direct model weights"
        )
        artifacts[path.name] = {
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
    elif index_path.is_file():
        index_path = safe_checkpoint_file(
            checkpoint, "model.safetensors.index.json", "model weight index"
        )
        try:
            index = json.loads(index_path.read_text(encoding="utf-8"))
            weight_map = index["weight_map"]
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as error:
            raise ValueError("model weight index is invalid") from error
        if not isinstance(weight_map, dict) or not weight_map:
            raise ValueError("model weight index has no tensor mappings")
        shard_names = set()
        for tensor_name, shard_name in weight_map.items():
            if not isinstance(tensor_name, str) or not tensor_name:
                raise ValueError("model weight index has an invalid tensor name")
            if not isinstance(shard_name, str) or not shard_name.endswith(".safetensors"):
                raise ValueError("model weight index has an invalid shard name")
            shard_names.add(shard_name)
        artifacts[index_path.name] = {
            "bytes": index_path.stat().st_size,
            "sha256": sha256_file(index_path),
        }
        for shard_name in sorted(shard_names):
            shard = safe_checkpoint_file(checkpoint, shard_name, "model weight shard")
            artifacts[shard_name] = {
                "bytes": shard.stat().st_size,
                "sha256": sha256_file(shard),
            }
    else:
        raise FileNotFoundError("checkpoint has no direct or indexed safetensors weights")

    for name in OPTIONAL_PROVENANCE_FILES:
        path = checkpoint / name
        if path.exists() or path.is_symlink():
            path = safe_checkpoint_file(
                checkpoint, name, "optional checkpoint file"
            )
            artifacts[name] = {
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
    if (checkpoint / "chat_templates").exists():
        raise ValueError(
            "chat_templates directories are unsupported until every selected "
            "template can be provenance-bound"
        )
    return artifacts


def source_generation_config(checkpoint: Path) -> dict[str, object]:
    path = checkpoint / "generation_config.json"
    if not path.is_file():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("generation_config.json is invalid") from error
    if not isinstance(value, dict):
        raise ValueError("generation_config.json must contain a JSON object")
    return value


def resolve_eos_token_id(
    source_generation: dict[str, object],
    tokenizer_eos_token_id: object,
    publisher_override: object = None,
) -> int | list[int]:
    value = (
        publisher_override
        if publisher_override is not None
        else source_generation.get("eos_token_id", tokenizer_eos_token_id)
    )
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    if (
        isinstance(value, list)
        and 0 < len(value) <= MAX_EOS_TOKEN_IDS
        and all(
            isinstance(token_id, int)
            and not isinstance(token_id, bool)
            and token_id >= 0
            for token_id in value
        )
        and len(set(value)) == len(value)
    ):
        return value
    raise ValueError(
        "eos_token_id must be a nonnegative integer or a bounded unique list"
    )


def publisher_generation_override(
    checkpoint: Path,
    token_ids: list[int] | None,
    authority_relative: str | None,
) -> dict[str, object] | None:
    if token_ids is None and authority_relative is None:
        return None
    if not token_ids or authority_relative is None:
        raise ValueError(
            "publisher EOS overrides require both --publisher-eos-token-id "
            "and --publisher-generation-authority-file"
        )
    eos_token_id = resolve_eos_token_id({}, None, token_ids)
    authority_path = Path(authority_relative)
    if authority_path.name != authority_relative:
        raise ValueError(
            "publisher generation authority must be a file in the checkpoint root"
        )
    authority = safe_checkpoint_file(
        checkpoint,
        authority_relative,
        "publisher generation authority",
    )
    authority_bytes = authority.stat().st_size
    if authority_bytes <= 0 or authority_bytes > MAX_GENERATION_AUTHORITY_BYTES:
        raise ValueError(
            "publisher generation authority must be nonempty and at most 1 MiB"
        )
    return {
        "authority_file": authority_relative,
        "authority_file_bytes": authority_bytes,
        "authority_file_sha256": sha256_file(authority),
        "eos_token_id": eos_token_id,
    }


def greedy_generation_parameters(
    source_generation: dict[str, object],
    tokenizer_eos_token_id: object,
    publisher_eos_token_id: object = None,
) -> dict[str, object]:
    eos_token_id = resolve_eos_token_id(
        source_generation,
        tokenizer_eos_token_id,
        publisher_eos_token_id,
    )
    pad_token_id = tokenizer_eos_token_id
    if not isinstance(pad_token_id, int) or isinstance(pad_token_id, bool):
        pad_token_id = eos_token_id[0] if isinstance(eos_token_id, list) else eos_token_id
    return {
        "do_sample": False,
        "repetition_penalty": 1.0,
        "pad_token_id": pad_token_id,
        "eos_token_id": eos_token_id,
        "temperature": None,
        "top_k": None,
        "top_p": None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("eval_cases", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source-model-id", required=True)
    parser.add_argument("--source-revision", required=True)
    parser.add_argument("--system-prompt")
    parser.add_argument(
        "--system-prompt-mode",
        choices=("included", "omitted-publisher-template"),
        default="included",
        help=(
            "Declare whether the pinned publisher chat template accepts a system "
            "message. Omitted mode rejects an explicit --system-prompt."
        ),
    )
    parser.add_argument(
        "--generation-profile",
        choices=("greedy", "source", "explicit"),
        default="greedy",
    )
    parser.add_argument("--seed", type=int, default=20260711)
    parser.add_argument("--sample", action="store_true")
    parser.add_argument("--temperature", type=float, default=1.0)
    parser.add_argument("--top-k", type=int, default=50)
    parser.add_argument("--top-p", type=float, default=1.0)
    parser.add_argument("--repetition-penalty", type=float, default=1.0)
    parser.add_argument(
        "--publisher-eos-token-id",
        action="append",
        type=int,
        help=(
            "Repeat for each EOS token explicitly required by a pinned publisher "
            "authority file when generation_config.json is incomplete or stale."
        ),
    )
    parser.add_argument(
        "--publisher-generation-authority-file",
        help=(
            "Checkpoint-root file that explicitly supports --publisher-eos-token-id; "
            "its path, size, and SHA-256 are bound into the raw report."
        ),
    )
    parser.add_argument(
        "--fix-mistral-regex",
        action="store_true",
        help=(
            "Use the Transformers compatibility correction for checkpoints whose "
            "stored tokenizer regex is known to be invalid. The choice is bound in "
            "the raw-quality report."
        ),
    )
    parser.add_argument("--disable-thinking", action="store_true")
    parser.add_argument(
        "--thinking-template-argument",
        choices=("enable_thinking", "thinking"),
        default="enable_thinking",
        help=(
            "Chat-template argument used when --disable-thinking is set; "
            "select the exact argument documented by the pinned source model."
        ),
    )
    parser.add_argument(
        "--policy-examples",
        type=Path,
        help="Optional hash-bound JSONL user/assistant policy examples.",
    )
    parser.add_argument(
        "--user-suffix",
        default="",
        help="Optional short policy instruction appended to each current user prompt.",
    )
    parser.add_argument(
        "--adapter",
        type=Path,
        help="Optional local PEFT adapter directory to apply before generation.",
    )
    args = parser.parse_args()
    try:
        effective_system_prompt = resolve_system_prompt(
            args.system_prompt_mode, args.system_prompt
        )
    except ValueError as error:
        parser.error(str(error))
    if (
        args.user_suffix != args.user_suffix.strip()
        or "\0" in args.user_suffix
        or len(args.user_suffix.encode("utf-8")) > 1024
    ):
        parser.error("--user-suffix must be trimmed, NUL-free, and at most 1024 bytes")

    checkpoint = args.checkpoint.resolve()
    eval_cases = args.eval_cases.resolve()
    output = args.output.resolve()
    try:
        generation_override = publisher_generation_override(
            checkpoint,
            args.publisher_eos_token_id,
            args.publisher_generation_authority_file,
        )
    except (FileNotFoundError, ValueError) as error:
        parser.error(str(error))
    publisher_eos_token_id = (
        generation_override["eos_token_id"]
        if generation_override is not None
        else None
    )
    cases = parse_eval_cases(eval_cases)
    policy_examples_path = (
        args.policy_examples.resolve() if args.policy_examples is not None else None
    )
    policy_examples = (
        parse_policy_examples(policy_examples_path)
        if policy_examples_path is not None
        else ()
    )
    policy_provenance = (
        {
            "path": str(policy_examples_path),
            "sha256": sha256_file(policy_examples_path),
            "record_count": len(policy_examples),
        }
        if policy_examples_path is not None
        else None
    )
    provenance = checkpoint_provenance(checkpoint)
    source_generation = source_generation_config(checkpoint)
    loader_contract = local_loader_contract(args.fix_mistral_regex)
    os.environ["TORCHDYNAMO_DISABLE"] = "1"

    try:
        import torch
        import transformers
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "reference quality capture requires the PyTorch and Transformers inference environment"
        ) from error

    load_started = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(
        checkpoint,
        local_files_only=True,
        trust_remote_code=False,
        fix_mistral_regex=args.fix_mistral_regex,
    )
    dtype_argument = (
        {"dtype": torch.float32}
        if int(transformers.__version__.split(".", 1)[0]) >= 5
        else {"torch_dtype": torch.float32}
    )
    model = AutoModelForCausalLM.from_pretrained(
        checkpoint,
        local_files_only=True,
        trust_remote_code=False,
        **dtype_argument,
    )
    adapter_provenance = None
    if args.adapter is not None:
        from peft import PeftModel

        adapter = args.adapter.resolve()
        adapter_weights = adapter / "adapter_model.safetensors"
        adapter_config = adapter / "adapter_config.json"
        if not adapter_weights.is_file() or not adapter_config.is_file():
            raise FileNotFoundError(
                "adapter must contain adapter_model.safetensors and adapter_config.json"
            )
        model = PeftModel.from_pretrained(
            model,
            adapter,
            is_trainable=False,
            local_files_only=True,
        )
        adapter_provenance = {
            "path": str(adapter),
            "adapter_model_sha256": sha256_file(adapter_weights),
            "adapter_config_sha256": sha256_file(adapter_config),
        }
    model.eval()
    load_seconds = time.perf_counter() - load_started

    if args.generation_profile == "source":
        generation_parameters: dict[str, object] = {
            "do_sample": bool(source_generation.get("do_sample", False)),
            "repetition_penalty": float(
                source_generation.get("repetition_penalty", 1.0)
            ),
            "pad_token_id": source_generation.get(
                "pad_token_id", tokenizer.eos_token_id
            ),
            "eos_token_id": resolve_eos_token_id(
                source_generation,
                tokenizer.eos_token_id,
                publisher_eos_token_id,
            ),
        }
        if generation_parameters["do_sample"]:
            generation_parameters.update(
                {
                    "temperature": float(source_generation.get("temperature", 1.0)),
                    "top_k": int(source_generation.get("top_k", 50)),
                    "top_p": float(source_generation.get("top_p", 1.0)),
                }
            )
    elif args.generation_profile == "greedy":
        generation_parameters = greedy_generation_parameters(
            source_generation,
            tokenizer.eos_token_id,
            publisher_eos_token_id,
        )
    else:
        if args.temperature <= 0.0:
            parser.error("--temperature must be positive for an explicit profile")
        if args.top_k <= 0:
            parser.error("--top-k must be positive for an explicit profile")
        if not 0.0 < args.top_p <= 1.0:
            parser.error("--top-p must be in (0, 1] for an explicit profile")
        if args.repetition_penalty <= 0.0:
            parser.error("--repetition-penalty must be positive")
        generation_parameters = {
            "do_sample": args.sample,
            "repetition_penalty": args.repetition_penalty,
            "pad_token_id": source_generation.get(
                "pad_token_id", tokenizer.eos_token_id
            ),
            "eos_token_id": resolve_eos_token_id(
                source_generation,
                tokenizer.eos_token_id,
                publisher_eos_token_id,
            ),
            "temperature": args.temperature if args.sample else None,
            "top_k": args.top_k if args.sample else None,
            "top_p": args.top_p if args.sample else None,
        }

    results: list[dict[str, object]] = []
    for case in cases:
        prompt = str(case["prompt"])
        max_new_tokens = int(case["max_new_tokens"])
        messages = conversation_messages(
            effective_system_prompt,
            policy_examples,
            prompt,
            args.user_suffix,
            history=tuple(case["history"]),
        )
        chat_template_options = thinking_template_options(
            args.disable_thinking,
            args.thinking_template_argument,
        )
        rendered = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            **chat_template_options,
        )
        encoded_prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
            **chat_template_options,
        )
        if isinstance(encoded_prompt, torch.Tensor):
            input_ids = encoded_prompt
            attention_mask = torch.ones_like(input_ids)
        else:
            input_ids = encoded_prompt["input_ids"]
            attention_mask = encoded_prompt.get("attention_mask")
            if attention_mask is None:
                attention_mask = torch.ones_like(input_ids)

        case_started = time.perf_counter()
        case_seed = args.seed + int(case["index"])
        torch.manual_seed(case_seed)
        with torch.inference_mode():
            generated = model.generate(
                input_ids,
                attention_mask=attention_mask,
                max_new_tokens=max_new_tokens,
                return_dict_in_generate=True,
                output_scores=True,
                **generation_parameters,
            )
        elapsed_seconds = time.perf_counter() - case_started

        prompt_ids = [int(token_id) for token_id in input_ids[0].tolist()]
        output_ids = [
            int(token_id)
            for token_id in generated.sequences[0, input_ids.shape[1] :].tolist()
        ]
        first_scores = generated.scores[0][0]
        top_values, top_indices = finite_topk(first_scores, torch)
        raw_output_text = tokenizer.decode(
            output_ids,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False,
        )
        required_answer_terms = tuple(case["required_answer_terms"])
        forbidden_answer_terms = tuple(case["forbidden_answer_terms"])
        results.append(
            {
                "index": int(case["index"]),
                "prompt": prompt,
                "history": list(case["history"]),
                "max_new_tokens": max_new_tokens,
                "required_answer_terms": list(required_answer_terms),
                "forbidden_answer_terms": list(forbidden_answer_terms),
                "declarative_term_assessment": assess_answer_terms(
                    raw_output_text,
                    required_answer_terms,
                    forbidden_answer_terms,
                ),
                "generation_call_count": 1,
                "output_transform": "none",
                "seed": case_seed,
                "rendered_prompt": rendered,
                "rendered_prompt_sha256": sha256_bytes(rendered.encode("utf-8")),
                "prompt_token_ids": prompt_ids,
                "prompt_token_sha256_le_u32": token_sha256(prompt_ids),
                "output_token_ids": output_ids,
                "output_token_sha256_le_u32": token_sha256(output_ids),
                "raw_output_text": raw_output_text,
                "first_step_top5": [
                    {
                        "token_id": int(token_id),
                        "logit": float(logit),
                        "token_text": tokenizer.decode(
                            [int(token_id)], clean_up_tokenization_spaces=False
                        ),
                    }
                    for logit, token_id in zip(
                        top_values.tolist(), top_indices.tolist(), strict=True
                    )
                ],
                "elapsed_seconds": elapsed_seconds,
            }
        )

    report = {
        "schema": REPORT_SCHEMA,
        "source_model_id": args.source_model_id,
        "source_revision": args.source_revision,
        "checkpoint": str(checkpoint),
        "checkpoint_artifacts": provenance,
        "adapter": adapter_provenance,
        "eval_cases": str(eval_cases),
        "eval_cases_sha256": sha256_file(eval_cases),
        "system_prompt_mode": args.system_prompt_mode,
        "system_prompt": effective_system_prompt,
        "policy_examples": policy_provenance,
        "user_suffix": args.user_suffix,
        "chat_template_options": chat_template_options,
        **loader_contract,
        **one_call_generation_contract(),
        "generation_profile": args.generation_profile,
        "generation_seed_base": args.seed,
        "generation": generation_parameters,
        "source_generation_config": source_generation,
        "publisher_generation_override": generation_override,
        "reference_framework": "transformers.AutoModelForCausalLM.generate",
        "torch_version": torch.__version__,
        "transformers_version": transformers.__version__,
        "dtype": "float32",
        "device": "cpu",
        "load_seconds": load_seconds,
        "case_count": len(results),
        "cases": results,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(serialize_report(report), encoding="utf-8")


if __name__ == "__main__":
    main()
