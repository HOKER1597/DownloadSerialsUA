from fastapi.testclient import TestClient

from app.main import create_app
from app.catalog.models import Catalog, Episode, ScanState, Variant
from app.downloads.models import DownloadJob, EpisodeProgress


def catalog() -> Catalog:
    variant = Variant(
        label="960p",
        width=1920,
        height=960,
        bandwidth=1_000_000,
        duration_seconds=30,
        estimated_bytes=3_750_000,
        playlist_url="https://ashdi.vip/video/index.m3u8",
        referer="https://ashdi.vip/video",
    )
    return Catalog(
        id="catalog",
        source_url="https://uakino.best/show.html",
        site="UAKINO",
        title="Детектив",
        season=4,
        episodes=[
            Episode(
                id="first",
                number=1,
                season=4,
                voice="Українська",
                source_url="https://ashdi.vip/video",
                variants=[variant],
            )
        ],
    )


def test_scan_api_persists_result_and_emits_websocket_events(tmp_path, monkeypatch):
    async def fake_scan(url, progress):
        assert url == "https://uakino.best/show.html"
        await progress(1, 1)
        return catalog()

    monkeypatch.setattr("app.catalog.service.scan_source", fake_scan)
    app = create_app(tmp_path, token="secret")
    with TestClient(app) as client:
        with client.websocket_connect("/api/events?token=secret") as socket:
            response = client.post(
                "/api/scans",
                headers={"X-App-Token": "secret"},
                json={"url": "https://uakino.best/show.html"},
            )
            assert response.status_code == 200
            assert socket.receive_json()["scan"]["done"] == 1
            assert socket.receive_json()["scan"]["status"] == "complete"
            scan_id = response.json()["id"]
            stored = client.get(f"/api/scans/{scan_id}", headers={"X-App-Token": "secret"}).json()
            assert stored["catalog"]["title"] == "Детектив"


def test_active_duplicate_is_rejected_then_can_be_cancelled_and_deleted(tmp_path):
    app = create_app(tmp_path / "data", token="secret")
    app.state.store.save_scan(ScanState(id="scan", status="complete", catalog=catalog()))
    app.state.store.save_job(
        DownloadJob(
            id="job",
            catalog_id="scan",
            title="Детектив",
            quality="w1920",
            output_dir=str(tmp_path),
            parallel_limit=1,
            status="downloading",
            estimated_bytes=3_750_000,
            episodes=[
                EpisodeProgress(
                    episode_id="first", number=1, season=4, voice="Українська", status="downloading"
                )
            ],
        )
    )
    headers = {"X-App-Token": "secret"}
    with TestClient(app) as client:
        duplicate = client.post(
            "/api/jobs",
            headers=headers,
            json={
                "catalog_id": "scan",
                "episode_ids": ["first"],
                "quality": "w1920",
                "output_dir": str(tmp_path),
                "parallel_limit": 1,
            },
        )
        assert duplicate.status_code == 400
        assert "вже завантажуються" in duplicate.json()["detail"]
        assert client.post("/api/jobs/job/cancel", headers=headers).json()["status"] == "cancelled"
        assert client.delete("/api/jobs/job", headers=headers).json() == {"deleted": True}
        assert client.get("/api/jobs/job", headers=headers).status_code == 404
