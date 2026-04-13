# input: FastAPI minimal app + BattlePrepService stub override
# output: Story 2.8 POST /personas/{id}/start-battle API 测试
# owner: wanhua.gu
# pos: 测试层 - Story 2.8 start-battle 路由测试；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""API tests for Story 2.8: POST /personas/{id}/start-battle (AC1, AC2)."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from api.dependencies import get_battle_prep_service
from api.routes.stakeholder import router
from application.services.stakeholder.dto import ChatRoomDTO
from core.exceptions import register_exception_handlers


class _StubBattlePrepService:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def create_room_from_persona(self, persona_id: str) -> ChatRoomDTO:
        self.calls.append(persona_id)
        if persona_id == "missing":
            raise ValueError(f"Persona {persona_id} not found")
        return ChatRoomDTO(
            id=42,
            name=f"演练: {persona_id}",
            type="private",
            persona_ids=[persona_id],
            scenario_id=None,
        )


@pytest.fixture
def client():
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(router, prefix="/api/v1")
    stub = _StubBattlePrepService()
    app.dependency_overrides[get_battle_prep_service] = lambda: stub
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test"), stub


@pytest.mark.asyncio
async def test_start_battle_happy(client) -> None:
    ac, stub = client
    async with ac as c:
        resp = await c.post("/api/v1/stakeholder/personas/cfo/start-battle")
        assert resp.status_code == 201
        body = resp.json()
        assert body["data"]["id"] == 42
        assert body["data"]["persona_ids"] == ["cfo"]
        assert body["data"]["type"] == "private"
    assert stub.calls == ["cfo"]


@pytest.mark.asyncio
async def test_start_battle_persona_not_found(client) -> None:
    ac, _ = client
    async with ac as c:
        resp = await c.post("/api/v1/stakeholder/personas/missing/start-battle")
        assert resp.status_code == 404
