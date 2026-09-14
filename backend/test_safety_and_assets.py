"""Regressions for disk safety, origin restrictions, and image persistence."""

import base64
import hashlib
import io
from pathlib import Path

import pytest
from PIL import Image
from fastapi.testclient import TestClient

import main


client = TestClient(main.app, raise_server_exceptions=False)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC")


@pytest.mark.parametrize("path", ["", ".", "/", "./"])
def test_cannot_delete_workspace_root(path, isolated_workspace):
    (isolated_workspace / "keep.tex").write_text("keep")
    response = client.post("/api/files/delete", json={"path": path})
    assert response.status_code == 403
    assert (isolated_workspace / "keep.tex").read_text() == "keep"


def test_cannot_rename_workspace_root(isolated_workspace):
    response = client.post("/api/files/rename", json={"old_path": "", "new_path": "moved"})
    assert response.status_code == 403
    assert isolated_workspace.exists()


def test_listing_does_not_follow_symlink_outside_workspace(isolated_workspace, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "private.txt").write_text("private")
    (isolated_workspace / "linked").symlink_to(outside, target_is_directory=True)
    response = client.get("/api/files")
    assert response.status_code == 200
    assert response.json() == []


def test_listing_does_not_follow_symlink_cycles(isolated_workspace):
    (isolated_workspace / "loop").symlink_to(isolated_workspace, target_is_directory=True)
    response = client.get("/api/files")
    assert response.status_code == 200
    assert response.json() == []


def test_deleting_symlink_does_not_delete_its_target(isolated_workspace):
    target = isolated_workspace / "keep.tex"
    target.write_text("keep")
    (isolated_workspace / "link.tex").symlink_to(target)
    response = client.post("/api/files/delete", json={"path": "link.tex"})
    assert response.status_code == 403
    assert target.read_text() == "keep"


def test_foreign_origin_cannot_select_or_write_workspace(isolated_workspace):
    response = client.post("/api/files/write", json={"path": "attack.tex", "content": "attack"},
                           headers={"Origin": "https://untrusted.example"})
    assert response.status_code == 403
    assert not (isolated_workspace / "attack.tex").exists()


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"])
def test_local_frontend_origin_works(origin):
    response = client.options("/api/files/write", headers={"Origin": origin,
        "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_revision_conflict_preserves_external_edit(isolated_workspace):
    target = isolated_workspace / "doc.tex"
    target.write_text("original")
    original = client.get("/api/files/read", params={"path": "doc.tex"}).json()
    assert original["revision"] == hashlib.sha256(b"original").hexdigest()
    target.write_text("external edit")
    response = client.post("/api/files/write", json={"path": "doc.tex", "content": "stale edit", "expected_revision": original["revision"]})
    assert response.status_code == 409
    assert response.json()["detail"]["current_revision"] == hashlib.sha256(b"external edit").hexdigest()
    assert target.read_text() == "external edit"


def test_successful_revision_save_returns_new_hash(isolated_workspace):
    target = isolated_workspace / "doc.tex"
    target.write_text("original")
    response = client.post("/api/files/write", json={"path": "doc.tex", "content": "updated", "expected_revision": hashlib.sha256(b"original").hexdigest()})
    assert response.status_code == 200
    assert response.json()["revision"] == hashlib.sha256(b"updated").hexdigest()
    assert target.read_text() == "updated"


def test_failed_atomic_save_preserves_original(isolated_workspace, monkeypatch):
    target = isolated_workspace / "doc.tex"
    target.write_text("original")
    real_replace = main.os.replace
    def fail_file_replace(src, dst):
        if Path(dst) == target:
            raise OSError("simulated disk failure")
        return real_replace(src, dst)
    monkeypatch.setattr(main.os, "replace", fail_file_replace)
    response = client.post("/api/files/write", json={"path": "doc.tex", "content": "updated"})
    assert response.status_code == 500
    assert target.read_text() == "original"
    assert list(isolated_workspace.iterdir()) == [target]


def test_upload_image_round_trip_survives_new_request(isolated_workspace):
    response = client.post("/api/assets/upload", json={"path": "assets/pixel.png", "content_base64": base64.b64encode(PNG).decode()})
    assert response.status_code == 200
    metadata = response.json()
    assert metadata["path"] == "assets/pixel.png"
    assert metadata["mime_type"] == "image/png"
    assert metadata["size"] == len(PNG)
    saved = client.get(metadata["url"])
    assert saved.status_code == 200
    assert saved.headers["content-type"] == "image/png"
    assert saved.headers["x-content-type-options"] == "nosniff"
    assert saved.content == PNG


@pytest.mark.parametrize("path,payload,status", [
    ("../outside.png", PNG, 403),
    ("assets/x.svg", b'<svg xmlns="http://www.w3.org/2000/svg"/>', 400),
    ("assets/x.png", b"not an image", 400),
    ("assets/x.jpg", PNG, 400),
])
def test_invalid_assets_rejected(path, payload, status):
    response = client.post("/api/assets/upload", json={"path": path, "content_base64": base64.b64encode(payload).decode()})
    assert response.status_code == status


def test_asset_upload_cannot_overwrite_existing_file(isolated_workspace):
    (isolated_workspace / "existing.png").write_bytes(PNG)
    response = client.post("/api/assets/upload", json={"path": "existing.png", "content_base64": base64.b64encode(PNG).decode()})
    assert response.status_code == 409
    assert (isolated_workspace / "existing.png").read_bytes() == PNG


def test_asset_upload_size_limit():
    response = client.post("/api/assets/upload", json={"path": "huge.png", "content_base64": base64.b64encode(b"x" * (10 * 1024 * 1024 + 1)).decode()})
    assert response.status_code == 413


def test_asset_get_does_not_serve_arbitrary_text(isolated_workspace):
    (isolated_workspace / "private.tex").write_text("secret")
    assert client.get("/api/assets", params={"path": "private.tex"}).status_code == 400


def test_capabilities_report_local_tools_and_upload_limits():
    response = client.get("/api/capabilities")
    assert response.status_code == 200
    metadata = response.json()
    assert {item["id"] for item in metadata["compilers"]} == {"pdflatex", "xetex", "luatex"}
    assert all(isinstance(item["available"], bool) for item in metadata["compilers"])
    assert metadata["assets"]["max_bytes"] == 10 * 1024 * 1024
    assert "image/png" in metadata["assets"]["mime_types"]


def test_create_document_has_initial_contents_and_revision(isolated_workspace):
    response = client.post("/api/files/create", json={"path": "new.tex", "type": "file", "content": "New document"})
    assert response.status_code == 200
    assert (isolated_workspace / "new.tex").read_text() == "New document"
    assert response.json()["revision"] == hashlib.sha256(b"New document").hexdigest()
    duplicate = client.post("/api/files/create", json={"path": "new.tex", "type": "file", "content": "Replace"})
    assert duplicate.status_code == 409
    assert (isolated_workspace / "new.tex").read_text() == "New document"


def test_revision_hash_matches_raw_crlf_bytes(isolated_workspace):
    (isolated_workspace / "crlf.tex").write_bytes(b"a\r\nb\r\n")
    response = client.get("/api/files/read", params={"path": "crlf.tex"})
    assert response.json()["content"] == "a\r\nb\r\n"
    assert response.json()["revision"] == hashlib.sha256(b"a\r\nb\r\n").hexdigest()


def test_create_does_not_overwrite_a_file_that_appears_during_save(isolated_workspace, monkeypatch):
    real_link = main.os.link
    target = isolated_workspace / "race.tex"
    def competing_creation(src, dst):
        target.write_text("created by another writer")
        return real_link(src, dst)
    monkeypatch.setattr(main.os, "link", competing_creation)
    response = client.post("/api/files/create", json={"path": "race.tex", "type": "file", "content": "our contents"})
    assert response.status_code == 409
    assert target.read_text() == "created by another writer"
    assert list(isolated_workspace.iterdir()) == [target]


@pytest.mark.parametrize("image_format,extension", [("GIF", "gif"), ("WEBP", "webp")])
def test_upload_converts_images_unsupported_by_tex_to_png(image_format, extension, isolated_workspace):
    stream = io.BytesIO()
    Image.new("RGB", (2, 2), (255, 0, 0)).save(stream, format=image_format)
    response = client.post("/api/assets/upload", json={"path": f"assets/picture.{extension}", "content_base64": base64.b64encode(stream.getvalue()).decode()})
    assert response.status_code == 200
    metadata = response.json()
    assert metadata["path"] == "assets/picture.png"
    assert metadata["mime_type"] == "image/png"
    assert client.get(metadata["url"]).content.startswith(b"\x89PNG\r\n\x1a\n")


def test_asset_upload_rejects_invalid_base64():
    response = client.post("/api/assets/upload", json={"path": "x.png", "content_base64": "%%%"})
    assert response.status_code == 400


def test_image_dimensions_are_bounded_before_decoding(monkeypatch):
    monkeypatch.setattr(main, "MAX_IMAGE_PIXELS", 1)
    stream = io.BytesIO()
    Image.new("RGB", (2, 2)).save(stream, format="PNG")
    response = client.post("/api/assets/upload", json={"path": "large.png", "content_base64": base64.b64encode(stream.getvalue()).decode()})
    assert response.status_code == 400


def test_truncated_jpeg_is_not_persisted(isolated_workspace):
    stream = io.BytesIO()
    Image.new("RGB", (100, 100)).save(stream, format="JPEG")
    truncated = stream.getvalue()[:-40]
    response = client.post("/api/assets/upload", json={"path": "broken.jpg", "content_base64": base64.b64encode(truncated).decode()})
    assert response.status_code == 400
    assert not (isolated_workspace / "broken.jpg").exists()


def test_origins_can_be_configured_but_cannot_be_public(monkeypatch):
    monkeypatch.setenv("NEXTEX_ALLOWED_ORIGINS", "http://localhost:9010,http://127.0.0.1:9010")
    assert main._allowed_origins() == ["http://localhost:9010", "http://127.0.0.1:9010"]
    monkeypatch.setenv("NEXTEX_ALLOWED_ORIGINS", "https://untrusted.example")
    with pytest.raises(ValueError):
        main._allowed_origins()
