import asyncio
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.jobs.manager import JobManager, select_variant
from app.jobs.store import Store
from app.main import create_app
from app.models import Catalog, DownloadJob, Episode, EpisodeProgress, ScanState, Variant
from app.system.open_path import resolve_job_path
from launch import configure_ffmpeg_path


def variant(label: str, width: int, height: int) -> Variant:
    return Variant(
        label=label,
        width=width,
        height=height,
        bandwidth=1_000_000,
        duration_seconds=30,
        estimated_bytes=3_750_000,
        playlist_url="https://ashdi.vip/video/index.m3u8",
        referer="https://ashdi.vip/video",
    )


def test_quality_group_uses_best_height_for_each_episode():
    first = [variant("1080p", 1920, 1080), variant("720p", 1280, 720)]
    second = [variant("960p", 1920, 960), variant("640p", 1280, 640)]
    assert select_variant(first, "w1920").label == "1080p"
    assert select_variant(second, "w1920").label == "960p"
    assert select_variant(second, "w1280").label == "640p"
    assert select_variant(second, "1080p") is None
    assert select_variant(second, "max").label == "960p"


def test_legacy_job_and_scan_survive_restart(tmp_path: Path):
    database = tmp_path / "state.sqlite3"
    partial = tmp_path / "episode.part.00000.ts"
    partial.write_bytes(b"partial video")
    store = Store(database)
    catalog = Catalog(
        id="catalog",
        source_url="https://uakino.best/show.html",
        site="UAKINO",
        title="Серіал",
        season=1,
        episodes=[
            Episode(
                id="episode",
                number=1,
                season=1,
                voice="Українська",
                source_url="https://ashdi.vip/video",
                variants=[variant("960p", 1920, 960)],
            )
        ],
    )
    store.save_scan(ScanState(id="scan", status="complete", catalog=catalog))
    store.save_job(
        DownloadJob(
            id="job",
            catalog_id="scan",
            title="Серіал",
            quality="max",
            output_dir=str(tmp_path),
            parallel_limit=1,
            status="failed",
            estimated_bytes=3_750_000,
            episodes=[
                EpisodeProgress(
                    episode_id="episode",
                    number=1,
                    season=1,
                    voice="Українська",
                    status="failed",
                    partial_file=str(partial),
                )
            ],
        )
    )
    store.close()
    with TestClient(create_app(tmp_path, token="test-token")) as client:
        headers = {"X-App-Token": "test-token"}
        assert client.get("/api/scans/scan", headers=headers).json()["catalog"]["title"] == "Серіал"
        job = client.get("/api/jobs/job", headers=headers).json()
        assert job["quality"] == "max"
        assert job["resolution"] == "1920 × 960"


def test_delete_job_removes_only_its_file(tmp_path: Path):
    own = tmp_path / "own.mp4"
    other = tmp_path / "other.mp4"
    own.write_bytes(b"video")
    other.write_bytes(b"keep")
    store = Store(tmp_path / "state.sqlite3")
    store.save_job(
        DownloadJob(
            id="job",
            catalog_id="scan",
            title="Фільм",
            quality="w1920",
            output_dir=str(tmp_path),
            parallel_limit=1,
            status="complete",
            estimated_bytes=5,
            episodes=[
                EpisodeProgress(
                    episode_id="episode",
                    number=1,
                    voice="Українська",
                    status="complete",
                    output_file=str(own),
                )
            ],
        )
    )
    manager = JobManager(store, lambda payload: asyncio.sleep(0))
    asyncio.run(manager.delete_job("job"))
    assert store.get_job("job") is None
    assert not own.exists()
    assert other.read_bytes() == b"keep"
    store.close()


def test_runner_ignores_job_removed_before_task_starts(tmp_path: Path):
    store = Store(tmp_path / "state.sqlite3")
    manager = JobManager(store, lambda payload: asyncio.sleep(0))
    asyncio.run(manager._run("removed-job"))
    assert store.list_jobs() == []
    store.close()


def test_open_file_refuses_path_outside_download_folder(tmp_path: Path):
    output_dir = tmp_path / "downloads"
    output_dir.mkdir()
    outside = tmp_path / "outside.mp4"
    outside.write_bytes(b"private")
    job = DownloadJob(
        id="job",
        catalog_id="scan",
        title="Фільм",
        quality="w1920",
        output_dir=str(output_dir),
        parallel_limit=1,
        status="complete",
        estimated_bytes=5,
        episodes=[
            EpisodeProgress(
                episode_id="episode",
                number=1,
                voice="Українська",
                status="complete",
                output_file=str(outside),
            )
        ],
    )
    with pytest.raises(ValueError, match="за межі папки"):
        resolve_job_path(job, "file", "episode")


def test_launcher_finds_private_ffmpeg_with_stale_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    bin_dir = tmp_path / "runtime" / "ffmpeg"
    bin_dir.mkdir(parents=True)
    for name in ("ffmpeg.exe", "ffprobe.exe"):
        (bin_dir / name).write_bytes(b"stub")
    monkeypatch.setenv("PATH", "")
    monkeypatch.setenv("KADR_INSTALL_ROOT", str(tmp_path))
    configure_ffmpeg_path()
    assert Path(shutil.which("ffmpeg")).parent == bin_dir
    assert Path(shutil.which("ffprobe")).parent == bin_dir
