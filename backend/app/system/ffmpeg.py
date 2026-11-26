from __future__ import annotations

import os
import shutil
from pathlib import Path


def configure_ffmpeg_path() -> None:
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        return

    local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    install_root = Path(os.environ.get("KADR_INSTALL_ROOT", local_app_data / "DownloadSerialsUA"))
    candidates = [
        install_root / "runtime" / "ffmpeg",
        Path(__file__).resolve().parents[3] / "runtime" / "ffmpeg",
        local_app_data / "Microsoft" / "WinGet" / "Links",
    ]
    packages = local_app_data / "Microsoft" / "WinGet" / "Packages"
    if packages.is_dir():
        candidates.extend(packages.glob("*FFmpeg*/*/bin"))

    for directory in candidates:
        if (directory / "ffmpeg.exe").is_file() and (directory / "ffprobe.exe").is_file():
            os.environ["PATH"] = f"{directory}{os.pathsep}{os.environ.get('PATH', '')}"
            return
