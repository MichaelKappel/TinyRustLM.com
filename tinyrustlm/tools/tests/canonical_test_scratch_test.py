"""Exercise ownership and lifecycle of canonical synthetic test scratch."""

import unittest
from pathlib import Path
from unittest import mock

from tinyrustlm.tools.tests import canonical_test_scratch as module


class CanonicalTestScratchTests(unittest.TestCase):
    """A fixture may clean up only its original marked directory."""

    def test_nested_fixture_cleanup_is_contained_and_idempotent(self) -> None:
        """Retain sibling data while removing this fixture and its separate marker."""
        first = module.CanonicalTestScratch("scratch-first-")
        second = module.CanonicalTestScratch("scratch-second-")
        self.addCleanup(first.cleanup)
        self.addCleanup(second.cleanup)
        data = Path(first.name)
        self.assertEqual(list(data.iterdir()), [])
        self.assertEqual(data.parent.parent, module.ARTIFACT_ROOT)
        (data / "nested").mkdir()
        (data / "nested" / "result.json").write_text("{}", encoding="ascii")
        first.cleanup()
        first.cleanup()
        self.assertFalse(data.parent.exists())
        self.assertTrue(Path(second.name).is_dir())

    def test_invalid_labels_fail_before_creating_output(self) -> None:
        """Labels cannot select a path or inject an unbounded filename."""
        for value in ("", "../escape", "A", "x" * 49, None):
            with self.subTest(label=value), self.assertRaises(ValueError):
                module.CanonicalTestScratch(value)

    def test_changed_owner_prevents_cleanup(self) -> None:
        """Preserve changed ownership until the original marker is restored."""
        scratch = module.CanonicalTestScratch("scratch-owner-")
        self.addCleanup(scratch.cleanup)
        owner = Path(scratch.name).parent / ".fixture-owner"
        original = owner.read_bytes()
        try:
            owner.write_text("other-owner", encoding="ascii")
            with self.assertRaisesRegex(ValueError, "ownership changed"):
                scratch.cleanup()
            self.assertTrue(Path(scratch.name).is_dir())
        finally:
            owner.write_bytes(original)

    def test_reparse_attribute_is_rejected(self) -> None:
        """Windows junction attributes must be checked even when is_symlink is false."""
        with (
            mock.patch.object(
                Path, "lstat", return_value=mock.Mock(st_file_attributes=0x400)
            ),
            mock.patch.object(Path, "is_symlink", return_value=False),
        ):
            with self.assertRaisesRegex(ValueError, "reparse"):
                module._ordinary(module.ARTIFACT_ROOT)

    def test_unreadable_inventory_prevents_cleanup(self) -> None:
        """An unreadable child must stop deletion while preserving owned data."""
        scratch = module.CanonicalTestScratch("scratch-unreadable-")
        self.addCleanup(scratch.cleanup)

        def fail_walk(*args, **kwargs):
            """Exercise the error callback supplied to the real filesystem walker."""
            kwargs["onerror"](PermissionError("unreadable fixture"))

        with mock.patch.object(module.os, "walk", side_effect=fail_walk):
            with self.assertRaisesRegex(PermissionError, "unreadable fixture"):
                scratch.cleanup()
        self.assertTrue(Path(scratch.name).is_dir())


if __name__ == "__main__":
    unittest.main()
