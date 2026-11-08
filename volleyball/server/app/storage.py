"""Where uploaded video files live.

LocalStorage keeps files on disk. A cloud deployment swaps in an
S3-compatible implementation (S3, Cloudflare R2, Backblaze B2) with the
same methods; the pipeline only ever asks for a local path to read.
"""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO, Protocol


class Storage(Protocol):
    def save(self, key: str, src: BinaryIO, max_bytes: int) -> int: ...
    def local_path(self, key: str) -> Path: ...
    def delete(self, key: str) -> None: ...


class UploadTooLarge(Exception):
    pass


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root.resolve() not in p.parents:
            raise ValueError("bad storage key")
        return p

    def save(self, key: str, src: BinaryIO, max_bytes: int) -> int:
        dest = self._path(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        written = 0
        try:
            with open(tmp, "wb") as out:
                while chunk := src.read(1024 * 1024):
                    written += len(chunk)
                    if written > max_bytes:
                        raise UploadTooLarge()
                    out.write(chunk)
            tmp.replace(dest)
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
        return written

    def local_path(self, key: str) -> Path:
        return self._path(key)

    def delete(self, key: str) -> None:
        p = self._path(key)
        if p.parent != self.root.resolve() and p.parent.exists():
            shutil.rmtree(p.parent, ignore_errors=True)
        else:
            p.unlink(missing_ok=True)
