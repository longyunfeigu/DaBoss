import pytest
from unittest.mock import AsyncMock, MagicMock
from application.services.defense_prep_service import DefensePrepService
from domain.defense_prep.value_objects import DocumentSummary
from domain.defense_prep.scenario import ScenarioType


@pytest.fixture
def mock_deps():
    uow = AsyncMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=False)
    uow.defense_session_repository = AsyncMock()
    uow.commit = AsyncMock()
    llm = AsyncMock()
    parser = AsyncMock()
    chatroom_svc = AsyncMock()
    persona_loader = MagicMock()
    return uow, llm, parser, chatroom_svc, persona_loader


class TestDefensePrepService:
    @pytest.mark.asyncio
    async def test_create_session_parses_doc_and_persists(self, mock_deps):
        uow, llm, parser, chatroom_svc, persona_loader = mock_deps
        parser.parse.return_value = DocumentSummary(title="Q1报告", sections=[], key_data=["30%"], raw_text="full text")
        uow.defense_session_repository.create.side_effect = lambda s: setattr(s, "id", 1) or s

        service = DefensePrepService(
            uow_factory=lambda: uow, llm=llm, document_parser=parser,
            chatroom_service=chatroom_svc, persona_loader=persona_loader,
        )
        session = await service.create_session(
            file_content=b"fake pptx bytes", filename="Q1报告.pptx",
            persona_id="persona-001", scenario_type=ScenarioType.PERFORMANCE_REVIEW,
        )
        parser.parse.assert_called_once_with(b"fake pptx bytes", "Q1报告.pptx")
        uow.defense_session_repository.create.assert_called_once()
        assert session.id == 1
        assert session.status == "preparing"
