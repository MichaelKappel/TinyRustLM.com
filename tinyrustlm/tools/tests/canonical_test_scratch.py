"""Own bounded non-product fixtures beneath this repository's artifacts directory."""

from __future__ import annotations

import os
import re
import shutil
import tempfile
import uuid
from pathlib import Path


ARTIFACT_ROOT = Path(__file__).resolve().parents[3] / "artifacts"
CANONICAL_ARTIFACT_ROOT = Path("E:/Source/Rust/TinyRustLM.com/artifacts")


def _ordinary(path: Path) -> None:
    """Reject links and reparse points before creating or deleting fixture output."""
    for part in (path, *path.parents):
        status = part.lstat()
        if part.is_symlink() or getattr(status, "st_file_attributes", 0) & 0x400:
            raise ValueError("test scratch crosses a reparse point")


def _enumeration_error(error: OSError) -> None:
    """Refuse incomplete enumeration rather than letting os.walk skip a directory."""
    raise error


class CanonicalTestScratch:
    """Keep the ownership marker outside initially empty synthetic fixture data."""

    def __init__(self, prefix: str) -> None:
        """Create one marked fixture; prefix is a short diagnostic label only."""
        if not isinstance(prefix, str) or not re.fullmatch(
            r"[a-z][a-z0-9-]{0,47}", prefix
        ):
            raise ValueError("invalid test scratch label")
        if ARTIFACT_ROOT != CANONICAL_ARTIFACT_ROOT:
            raise ValueError("test scratch requires the canonical repository")
        _ordinary(ARTIFACT_ROOT)
        self._container = Path(tempfile.mkdtemp(prefix=prefix, dir=ARTIFACT_ROOT))
        self._owner = uuid.uuid4().hex
        (self._container / ".fixture-owner").write_text(self._owner, encoding="ascii")
        data = self._container / "data"
        data.mkdir()
        self.name = str(data)
        self._closed = False

    def cleanup(self) -> None:
        """Remove only this marked, ordinary bounded tree; repeated cleanup is safe."""
        if self._closed:
            return
        _ordinary(self._container)
        if self._container.parent != ARTIFACT_ROOT:
            raise ValueError("test scratch escaped canonical artifacts")
        owner = self._container / ".fixture-owner"
        _ordinary(owner)
        if (
            owner.stat().st_size != len(self._owner)
            or owner.read_text(encoding="ascii") != self._owner
        ):
            raise ValueError("test scratch ownership changed")
        count = 0
        for current, directories, files in os.walk(
            self._container, followlinks=False, onerror=_enumeration_error
        ):
            if len(Path(current).relative_to(self._container).parts) > 32:
                raise ValueError("test scratch depth exceeded")
            for name in (*directories, *files):
                count += 1
                if count > 4096:
                    raise ValueError("test scratch inventory exceeded")
                _ordinary(Path(current) / name)
        shutil.rmtree(self._container)
        self._closed = True
