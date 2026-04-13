#!/usr/bin/env python3
# input: data/personas/*.md, DB schema_version=1 personas, STAKEHOLDER__ANTHROPIC_API_KEY, settings.stakeholder.persona_dir
# output: 迁移日志 + Migrated/Failed/Skipped 汇总；DB 中相关 persona 升级到 schema_version=2，失败项写入 structured_profile._error
# owner: wanhua.gu
# pos: 脚本工具 - 旧 markdown persona → v2 5-layer 结构化迁移 CLI (Story 2.3)；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""CLI: migrate v1 markdown personas (disk + DB) to v2 5-layer structured form.

Story 2.3 entrypoint. Examples:

    # Dry-run (no LLM calls, no DB writes)
    cd backend && uv run python scripts/migrate_personas_to_v2.py --dry-run

    # Real migration (requires STAKEHOLDER__ANTHROPIC_API_KEY)
    cd backend && uv run python scripts/migrate_personas_to_v2.py

幂等：再次运行会自动 skip 已 schema_version=2 的 persona。
失败隔离：单条 LLM 失败不阻塞其他 persona；失败原因写入 structured_profile._error。
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Allow `python scripts/migrate_personas_to_v2.py` from backend/ root
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from application.services.stakeholder.persona_loader import PersonaLoader  # noqa: E402
from application.services.stakeholder.persona_migrator import (  # noqa: E402
    load_prompt,
    print_report,
    run_migration,
)
from core.config import settings  # noqa: E402
from core.logging_config import configure_logging, get_logger  # noqa: E402
from domain.stakeholder.persona_entity import Persona  # noqa: E402
from infrastructure.database import AsyncSessionLocal  # noqa: E402
from infrastructure.external.llm.anthropic_provider import AnthropicProvider  # noqa: E402
from infrastructure.repositories.stakeholder_persona_repository import (  # noqa: E402
    SQLAlchemyStakeholderPersonaRepository,
)

logger = get_logger(__name__)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate v1 markdown personas to v2 5-layer structured form (Story 2.3)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="不调用 LLM，不写 DB；仅打印将要迁移的 persona 列表",
    )
    return parser.parse_args(argv)


_TEMPLATE_IDS = {"template"}


def _scan_disk_personas(persona_dir: Path) -> list[Persona]:
    """Use PersonaLoader's existing markdown parser to load disk v1 personas.

    Excludes well-known template files (e.g. TEMPLATE.md) — those are scaffolding
    for human authors, not real stakeholder personas.
    """
    loader = PersonaLoader(str(persona_dir))
    return [p for p in loader.list_personas() if p.id.lower() not in _TEMPLATE_IDS]


async def main_async(args: argparse.Namespace) -> int:
    configure_logging()

    persona_dir = Path(settings.stakeholder.persona_dir)
    disk_personas = _scan_disk_personas(persona_dir)
    logger.info(
        "scan_disk_personas",
        persona_dir=str(persona_dir),
        count=len(disk_personas),
        ids=[p.id for p in disk_personas],
    )

    prompt = load_prompt()

    # LLM client (skipped construction for dry-run to avoid requiring api key)
    if args.dry_run:
        llm = _DryRunLLM()
    else:
        api_key = settings.stakeholder.anthropic_api_key
        if not api_key:
            print(
                "ERROR: STAKEHOLDER__ANTHROPIC_API_KEY not set; "
                "use --dry-run to preview without LLM, or set the env var.",
                file=sys.stderr,
            )
            return 2
        llm = AnthropicProvider(
            api_key=api_key,
            base_url=settings.stakeholder.anthropic_base_url,
            default_model=settings.stakeholder.model,
            default_temperature=0.2,  # deterministic JSON
            default_max_tokens=4096,
        )

    async with AsyncSessionLocal() as session:
        repo = SQLAlchemyStakeholderPersonaRepository(session)
        report = await run_migration(
            repo=repo,
            llm=llm,
            disk_personas=disk_personas,
            prompt=prompt,
            dry_run=args.dry_run,
        )
        await session.commit()

    print_report(report)
    return 0


class _DryRunLLM:
    """Sentinel LLM that asserts it should never be called during --dry-run."""

    async def generate(self, *args, **kwargs):  # pragma: no cover - guarded by run_migration
        raise AssertionError("LLM.generate must not be called in --dry-run mode")

    async def stream(self, *args, **kwargs):  # pragma: no cover
        raise AssertionError("LLM.stream must not be called in --dry-run mode")


def main() -> int:
    args = parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
