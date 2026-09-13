"""Exercise numerical environment rejection without model loads or disk fixtures."""

import copy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[3]


def load_module(name, relative_path):
    """Import canonical source in place; never materialize another source tree."""
    specification = importlib.util.spec_from_file_location(name, ROOT / relative_path)
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


owner = load_module("source_owner_test_target", "tinyrustlm/tools/qwen3-numerical-source-owner.py")
authority = load_module("source_owner_test_authority", owner.ENVIRONMENT_AUTHORITY_RELATIVE_PATH)


class NumericalEnvironmentTests(unittest.TestCase):
    """Identity checks and typed errors must survive the owner/authority boundary."""

    def setUp(self):
        """Bind real helper/lock bytes and replace only environment observation."""
        self.framework = {
            "environmentAuthority": owner.content_identity(
                ROOT / owner.ENVIRONMENT_AUTHORITY_RELATIVE_PATH,
                owner.MAXIMUM_JSON_BYTES, "test-authority",
            ),
            "environmentLock": owner.content_identity(
                ROOT / owner.ENVIRONMENT_LOCK_RELATIVE_PATH,
                owner.MAXIMUM_JSON_BYTES, "test-lock",
            ),
        }
        self.observed = {
            "profileId": authority.PROFILE_ID,
            "runtimeClosureSha256": "a" * 64,
        }
        self.runtime = mock.Mock(return_value=self.observed)
        self.module = SimpleNamespace(
            EnvironmentLockError=authority.EnvironmentLockError,
            verify_running_environment=self.runtime,
        )
        self.loader = mock.Mock()
        self.specification = SimpleNamespace(loader=self.loader)
        self.enterContext(mock.patch.object(
            owner.importlib.util, "spec_from_file_location", return_value=self.specification,
        ))
        self.enterContext(mock.patch.object(
            owner.importlib.util, "module_from_spec", return_value=self.module,
        ))

    def assert_rejection(self, code, framework=None):
        """Compare the entire error, preventing path/message leakage or ambiguity."""
        with self.assertRaises(owner.SourceOwnerFailure) as raised:
            owner.verify_environment(self.framework if framework is None else framework)
        self.assertEqual(str(raised.exception), code)

    def test_valid_environment_returns_exact_bound_identity(self):
        """Success retains the existing metadata contract and request hash binding."""
        result = owner.verify_environment(self.framework)
        self.assertEqual(result, {
            "authority": {
                "relativePath": owner.ENVIRONMENT_AUTHORITY_RELATIVE_PATH,
                **self.framework["environmentAuthority"],
            },
            "lock": {
                "relativePath": owner.ENVIRONMENT_LOCK_RELATIVE_PATH,
                **self.framework["environmentLock"],
                **self.observed,
            },
        })
        lock = self.framework["environmentLock"]
        self.runtime.assert_called_once_with(
            ROOT / owner.ENVIRONMENT_LOCK_RELATIVE_PATH, lock["byteLength"], lock["sha256"],
        )
        self.loader.exec_module.assert_called_once_with(self.module)

    def test_typed_rejections_preserve_distinct_causes(self):
        """Config, interpreter, package, record and closure failures stay distinct."""
        for suffix in (
            "config", "python", "base", "distribution-version",
            "distribution-record-drift", "closure-link", "closure-limit",
            "lock-identity", "lock-schema", "runtime-drift",
        ):
            with self.subTest(suffix=suffix):
                self.runtime.side_effect = authority.EnvironmentLockError(
                    "qwen3-numerical-environment-" + suffix,
                )
                self.assert_rejection("source-trace-environment-" + suffix)

    def test_arbitrary_exception_messages_never_escape(self):
        """Even a lookalike code on an untyped exception cannot cross the boundary."""
        error = RuntimeError(r"private E:\secret\environment failed")
        error.code = "qwen3-numerical-environment-config"
        self.runtime.side_effect = error
        self.assert_rejection("source-trace-environment-drift")

    def test_malformed_typed_codes_are_redacted(self):
        """Reject paths, controls, foreign prefixes, nonstrings and unbounded codes."""
        for code in (
            None, 7, "", "qwen3-numerical-environment-", "foreign-config",
            "qwen3-numerical-environment-Config", "qwen3-numerical-environment--config",
            "qwen3-numerical-environment-config\nprivate",
            r"qwen3-numerical-environment-E:\private",
            "qwen3-numerical-environment-" + "a" * 129,
        ):
            with self.subTest(code=code):
                self.runtime.side_effect = authority.EnvironmentLockError(code)
                self.assert_rejection("source-trace-environment-drift")

    def test_owner_rejection_is_not_masked(self):
        """An existing owner failure keeps its original safe code."""
        self.runtime.side_effect = owner.SourceOwnerFailure("source-trace-environment-lock")
        self.assert_rejection("source-trace-environment-lock")

    def test_identity_drift_prevents_import_and_runtime_observation(self):
        """Changing either request identity fails before the helper executes."""
        for key, suffix in (("environmentAuthority", "authority"), ("environmentLock", "lock")):
            for field, value in (("byteLength", 1), ("sha256", "0" * 64)):
                with self.subTest(key=key, field=field):
                    framework = copy.deepcopy(self.framework)
                    framework[key][field] = value
                    self.assert_rejection("source-trace-environment-" + suffix, framework)
        self.runtime.assert_not_called()
        self.loader.exec_module.assert_not_called()

    def test_missing_loader_rejects_without_observation(self):
        """Both missing module specifications and loaders fail before execution."""
        for specification in (None, SimpleNamespace(loader=None)):
            with self.subTest(specification=specification), mock.patch.object(
                owner.importlib.util, "spec_from_file_location", return_value=specification,
            ):
                self.assert_rejection("source-trace-environment-authority")
        self.runtime.assert_not_called()

    def test_import_failure_remains_generic(self):
        """A helper import failure cannot masquerade as runtime validation evidence."""
        self.loader.exec_module.side_effect = authority.EnvironmentLockError(
            "qwen3-numerical-environment-config",
        )
        self.assert_rejection("source-trace-environment-drift")
        self.runtime.assert_not_called()


if __name__ == "__main__":
    unittest.main()
