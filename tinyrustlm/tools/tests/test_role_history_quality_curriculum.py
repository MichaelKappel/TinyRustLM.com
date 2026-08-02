"""Repository contract for the first structured role-history quality curriculum."""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from collections import Counter
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
TRAINING_ROOT = REPOSITORY_ROOT / "tinyrustlm" / "training" / "role-history-quality-v1"
TEACHER_SCRIPT = REPOSITORY_ROOT / "tinyrustlm" / "tools" / "prepare-distillation-teacher-corpus.py"
SPEC = importlib.util.spec_from_file_location("tinyrustlm_role_history_curriculum", TEACHER_SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class RoleHistoryQualityCurriculumTests(unittest.TestCase):
    def test_curriculum_is_hash_bound_role_complete_and_exclusion_clean(self) -> None:
        control_path = TRAINING_ROOT / "collection-control.local.json"
        control = json.loads(control_path.read_text(encoding="utf-8"))
        prompt_path = Path(control["prompt_plan"]["path"])
        system_path = Path(control["generation"]["system_prompt_file"])
        self.assertEqual(MODULE.sha256_file(prompt_path), control["prompt_plan"]["sha256"])
        self.assertEqual(
            MODULE.sha256_file(system_path), control["generation"]["system_prompt_sha256"]
        )

        prompts = MODULE.read_prompt_plan(prompt_path)
        self.assertEqual(len(prompts), 42)
        self.assertEqual(len({prompt.record_id for prompt in prompts}), 42)
        self.assertTrue(all(2 <= len(prompt.history) <= 12 for prompt in prompts))
        self.assertTrue(all(len(prompt.history) % 2 == 0 for prompt in prompts))
        for prompt in prompts:
            self.assertEqual(
                [message.role for message in prompt.history],
                ["user" if index % 2 == 0 else "assistant" for index in range(len(prompt.history))],
            )

        families = Counter(prompt.task_family for prompt in prompts)
        self.assertGreaterEqual(families["multi-turn-state"], 12)
        self.assertGreaterEqual(families["practical-judgment"], 10)
        self.assertGreaterEqual(families["instruction-conflict"], 5)
        self.assertGreaterEqual(families["prompt-injection"], 5)

        exclusions = tuple(
            MODULE.read_exclusion(
                Path(identity["path"]), MODULE.require_sha256(identity["sha256"], "sha256")
            )
            for identity in control["eval_exclusions"]
        )
        exclusion_index = MODULE.build_exclusion_index(exclusions)
        for prompt in prompts:
            MODULE.reject_contamination(
                prompt.record_id, "prompt", prompt.prompt, exclusion_index
            )
            MODULE.reject_contamination(
                prompt.record_id,
                "role history",
                MODULE.render_role_content(prompt.history, prompt.prompt),
                exclusion_index,
            )

    def test_agent_suggestions_are_sparse_and_never_human_authority(self) -> None:
        suggestions = [
            json.loads(line)
            for line in (TRAINING_ROOT / "agent-review-suggestions-v1.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
            if line
        ]
        self.assertEqual(len(suggestions), 4)
        self.assertEqual({suggestion["action"] for suggestion in suggestions}, {"rewrite"})
        self.assertTrue(
            all(suggestion["agent_id"] == "tinyrustlm-agent" for suggestion in suggestions)
        )
        self.assertFalse(any("approved" in json.dumps(suggestion).lower() for suggestion in suggestions))


if __name__ == "__main__":
    unittest.main()
