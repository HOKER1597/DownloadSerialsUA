from __future__ import annotations

import asyncio
import base64
import os
import subprocess
import winreg
from pathlib import Path


def default_downloads_folder() -> str:
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
        ) as key:
            raw = winreg.QueryValueEx(key, "{374DE290-123F-4565-9164-39C4925E467B}")[0]
            return os.path.expandvars(raw)
    except OSError:
        return str(Path.home() / "Downloads")


async def choose_folder(selected_path: str) -> str:
    encoded_path = base64.b64encode(selected_path.encode("utf-8")).decode("ascii")
    command = (
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; "
        f"$selected=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{encoded_path}')); "
        "$d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Оберіть папку для завантаження'; "
        "if($selected -and [IO.Directory]::Exists($selected)) { $d.SelectedPath=$selected }; "
        "if($d.ShowDialog() -eq 'OK') { [Console]::Write($d.SelectedPath) }"
    )
    process = await asyncio.to_thread(
        subprocess.run,
        ["powershell", "-NoProfile", "-STA", "-Command", command],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=300,
    )
    return process.stdout.strip() if process.returncode == 0 else ""
