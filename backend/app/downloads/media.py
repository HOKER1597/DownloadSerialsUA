from __future__ import annotations

import asyncio
import json
import shutil
import time
from pathlib import Path

from app.catalog.sources.http import BROWSER_USER_AGENT
from app.downloads.models import DownloadJob, EpisodeProgress


async def valid_video(path: Path, expected_duration: float) -> bool:
    if not path.exists() or path.stat().st_size < 1024:
        return False
    probe = shutil.which("ffprobe")
    if not probe:
        raise RuntimeError("Не знайдено ffprobe. Встановіть FFmpeg і запустіть застосунок знову.")
    process = await asyncio.create_subprocess_exec(
        probe,
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await process.communicate()
    if process.returncode:
        return False
    try:
        data = json.loads(stdout)
        duration = float(data["format"]["duration"])
        types = {stream["codec_type"] for stream in data["streams"]}
    except (ValueError, KeyError, TypeError):
        return False
    return duration >= expected_duration * 0.95 and {"audio", "video"} <= types


async def media_duration(path: Path) -> float:
    probe = shutil.which("ffprobe")
    if not probe or not path.is_file() or path.stat().st_size < 1316:
        return 0
    process = await asyncio.create_subprocess_exec(
        probe,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await process.communicate()
    try:
        return float(stdout.decode().strip()) if process.returncode == 0 else 0
    except ValueError:
        return 0


class MediaOperations:
    async def _assemble(
        self, job: DownloadJob, progress: EpisodeProgress, concat_file: Path, output: Path
    ) -> None:
        process = await asyncio.create_subprocess_exec(
            shutil.which("ffmpeg"),
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0",
            "-c",
            "copy",
            "-bsf:a",
            "aac_adtstoasc",
            str(output),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self.processes[(job.id, progress.episode_id)] = process
        try:
            _, stderr = await process.communicate()
        finally:
            self.processes.pop((job.id, progress.episode_id), None)
        if process.returncode:
            raise RuntimeError(
                stderr.decode("utf-8", errors="replace")[-500:]
                or "Не вдалося об’єднати частини відео."
            )

    @staticmethod
    def _concat_quote(value: str) -> str:
        # ffmpeg concat demuxer uses shell-like single-quoted paths with backslash escapes.
        return "'" + value.replace("\\", "/").replace("'", "'\\''") + "'"

    async def _ffmpeg(
        self,
        job: DownloadJob,
        progress: EpisodeProgress,
        url: str,
        referer: str,
        output: Path,
        duration: float,
        *,
        start_seconds: float = 0,
        previous_bytes: int = 0,
        mpegts: bool = False,
    ) -> None:
        input_args = (["-ss", f"{start_seconds:.3f}"] if start_seconds > 0 else []) + ["-i", url]
        output_args = ["-f", "mpegts"] if mpegts else ["-bsf:a", "aac_adtstoasc"]
        process = await asyncio.create_subprocess_exec(
            shutil.which("ffmpeg"),
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-stats_period",
            "0.5",
            "-progress",
            "pipe:1",
            "-headers",
            f"Referer: {referer}\r\nUser-Agent: {BROWSER_USER_AGENT}\r\n",
            *input_args,
            "-map",
            "0:v:0",
            "-map",
            "0:a:0",
            "-sn",
            "-c",
            "copy",
            *output_args,
            str(output),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self.processes[(job.id, progress.episode_id)] = process
        stderr_task = asyncio.create_task(process.stderr.read())
        values: dict[str, str] = {}
        last_update = 0.0
        last_size = 0
        last_sample = time.monotonic()
        try:
            while line := await process.stdout.readline():
                text = line.decode("utf-8", errors="replace").strip()
                if "=" not in text:
                    continue
                key, value = text.split("=", 1)
                values[key] = value
                if key == "progress" and time.monotonic() - last_update > 0.5:
                    now = time.monotonic()
                    raw_time = values.get("out_time_us", values.get("out_time_ms", "0"))
                    try:
                        seconds = float(raw_time) / 1_000_000
                    except ValueError:
                        seconds = 0
                    if seconds > 0 and duration:
                        progress.percent = round(
                            min(99.9, (start_seconds + seconds) / duration * 100), 1
                        )
                    raw_size = values.get("total_size", "0")
                    try:
                        current_size = int(raw_size)
                    except ValueError:
                        current_size = last_size
                    progress.bytes_written = previous_bytes + current_size
                    if now > last_sample and current_size >= last_size:
                        progress.speed_bytes = (current_size - last_size) / (now - last_sample)
                    last_size, last_sample = current_size, now
                    progress.speed = values.get("speed", "")
                    await self._publish(job)
                    last_update = now
                    values.clear()
            await process.wait()
            stderr = (await stderr_task).decode("utf-8", errors="replace")
            if process.returncode:
                raise RuntimeError(
                    stderr[-500:] or f"FFmpeg завершився з кодом {process.returncode}."
                )
        finally:
            if process.returncode is None:
                process.terminate()
            await process.wait()
            await stderr_task
            self.processes.pop((job.id, progress.episode_id), None)
