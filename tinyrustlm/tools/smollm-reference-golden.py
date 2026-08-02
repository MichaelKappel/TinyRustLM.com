"""Generate source-locked SmolLM full-logit conformance evidence from local files."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path

import torch
import transformers
from transformers import AutoModelForCausalLM, AutoTokenizer


SYSTEM_PROMPT = (
    "You are TinyRustLM, a browser-local AI assistant. "
    "You do not have personal experiences. Answer directly and helpfully."
)
REQUIRED_CHECKPOINT_FILES = (
    "model.safetensors",
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "generation_config.json",
    "merges.txt",
)


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


def parse_eval_cases(path: Path) -> list[dict[str, object]]:
    fields: dict[str, str] = {}
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"eval case line {line_number} is missing '='")
        key, value = line.split("=", 1)
        if not key or not value or key in fields:
            raise ValueError(f"eval case line {line_number} is empty or duplicated")
        fields[key] = value
    if fields.get("tinyrustlm_eval_cases_version") != "1":
        raise ValueError("eval fixture must use tinyrustlm_eval_cases_version=1")
    case_count = int(fields["case_count"])
    cases: list[dict[str, object]] = []
    for index in range(case_count):
        prompt = fields[f"case.{index}.prompt"]
        max_new_tokens = int(fields[f"case.{index}.max_new_tokens"])
        if max_new_tokens <= 0:
            raise ValueError(f"case {index} max_new_tokens must be positive")
        cases.append({"prompt": prompt, "max_new_tokens": max_new_tokens})
    return cases


def checkpoint_hashes(checkpoint: Path) -> dict[str, dict[str, object]]:
    artifacts: dict[str, dict[str, object]] = {}
    for name in REQUIRED_CHECKPOINT_FILES:
        path = checkpoint / name
        if not path.is_file():
            raise FileNotFoundError(f"required checkpoint artifact is missing: {path}")
        artifacts[name] = {"bytes": path.stat().st_size, "sha256": sha256_file(path)}
    return artifacts


def write_logits(path: Path, logits: torch.Tensor) -> str:
    normalized = logits.detach().to(device="cpu", dtype=torch.float32).contiguous()
    payload = normalized.numpy().astype("<f4", copy=False).tobytes()
    path.write_bytes(payload)
    return sha256_bytes(payload)


def greedy_token_ids(
    model: AutoModelForCausalLM,
    input_ids: torch.Tensor,
    eos_token_id: int,
    max_new_tokens: int,
) -> list[int]:
    sequence = input_ids
    generated: list[int] = []
    for _ in range(max_new_tokens):
        attention_mask = torch.ones_like(sequence)
        logits = model(
            input_ids=sequence,
            attention_mask=attention_mask,
            use_cache=False,
        ).logits[0, -1, :]
        next_token = int(torch.argmax(logits).item())
        if next_token == eos_token_id:
            break
        generated.append(next_token)
        next_tensor = torch.tensor([[next_token]], dtype=sequence.dtype)
        sequence = torch.cat((sequence, next_tensor), dim=1)
    return generated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("eval_cases", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--source-model-id", required=True)
    parser.add_argument("--source-revision", required=True)
    args = parser.parse_args()

    checkpoint = args.checkpoint.resolve()
    eval_cases = args.eval_cases.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    cases = parse_eval_cases(eval_cases)
    artifacts = checkpoint_hashes(checkpoint)
    config = json.loads((checkpoint / "config.json").read_text(encoding="utf-8"))
    generation_config = json.loads(
        (checkpoint / "generation_config.json").read_text(encoding="utf-8")
    )

    tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
    model = AutoModelForCausalLM.from_pretrained(
        checkpoint,
        local_files_only=True,
        torch_dtype=torch.float32,
    )
    model.eval()

    results: list[dict[str, object]] = []
    for index, case in enumerate(cases):
        prompt = str(case["prompt"])
        messages = (
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        )
        rendered = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        rendered_bytes = rendered.encode("utf-8")
        prompt_path = output_dir / f"case-{index}.rendered-prompt.txt"
        prompt_path.write_bytes(rendered_bytes)
        input_ids = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
        )
        attention_mask = torch.ones_like(input_ids)
        with torch.inference_mode():
            first_step_logits = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
            ).logits[0, -1, :]
            output_ids = greedy_token_ids(
                model,
                input_ids,
                tokenizer.eos_token_id,
                max_new_tokens=8,
            )
        logits_path = output_dir / f"case-{index}.logits.f32le"
        logits_sha256 = write_logits(logits_path, first_step_logits)
        top_values, top_indices = torch.topk(first_step_logits, 32)
        prompt_ids = [int(token_id) for token_id in input_ids[0].tolist()]
        results.append(
            {
                "index": index,
                "prompt": prompt,
                "rendered_prompt_file": prompt_path.name,
                "rendered_prompt_bytes": len(rendered_bytes),
                "rendered_prompt_sha256": sha256_bytes(rendered_bytes),
                "prompt_token_ids": prompt_ids,
                "prompt_token_sha256_le_u32": token_sha256(prompt_ids),
                "logits_file": logits_path.name,
                "logits_encoding": "f32-little-endian",
                "logit_count": int(first_step_logits.numel()),
                "logits_sha256": logits_sha256,
                "first_step_top32": [
                    {
                        "token_id": int(token_id),
                        "logit": float(logit),
                        "token_text": tokenizer.decode([int(token_id)]),
                    }
                    for logit, token_id in zip(top_values.tolist(), top_indices.tolist())
                ],
                "greedy_8_token_ids": output_ids,
                "greedy_8_text": tokenizer.decode(output_ids, skip_special_tokens=True),
            }
        )

    report = {
        "schema": "tinyrustlm.reference_logit_golden.v1",
        "source_model_id": args.source_model_id,
        "source_revision": args.source_revision,
        "checkpoint_artifacts": artifacts,
        "eval_cases_path": str(eval_cases),
        "eval_cases_sha256": sha256_file(eval_cases),
        "reference_framework": "transformers.AutoModelForCausalLM",
        "torch_version": torch.__version__,
        "transformers_version": transformers.__version__,
        "dtype": "float32",
        "device": "cpu",
        "system_prompt": SYSTEM_PROMPT,
        "model_config": {
            "vocab_size": config["vocab_size"],
            "hidden_size": config["hidden_size"],
            "num_hidden_layers": config["num_hidden_layers"],
            "num_attention_heads": config["num_attention_heads"],
            "num_key_value_heads": config["num_key_value_heads"],
            "intermediate_size": config["intermediate_size"],
            "max_position_embeddings": config["max_position_embeddings"],
            "rope_theta": config["rope_theta"],
            "rms_norm_eps": config["rms_norm_eps"],
            "tie_word_embeddings": config["tie_word_embeddings"],
            "bos_token_id": config["bos_token_id"],
            "eos_token_id": config["eos_token_id"],
            "pad_token_id": config["pad_token_id"],
        },
        "generation_config": generation_config,
        "case_count": len(results),
        "cases": results,
    }
    (output_dir / "reference-golden.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
