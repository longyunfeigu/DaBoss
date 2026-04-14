"""competency_eval_room_id_set_null

Revision ID: c81263f68d3d
Revises: b3c7f2a1d456
Create Date: 2026-04-14 16:49:28.813133

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c81263f68d3d'
down_revision: Union[str, Sequence[str], None] = 'b3c7f2a1d456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# SQLite batch mode needs naming_convention to locate unnamed FK constraints.
naming_convention = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}


def upgrade() -> None:
    """Change room_id FK from CASCADE to SET NULL and make nullable."""
    with op.batch_alter_table(
        'stakeholder_competency_evaluations',
        naming_convention=naming_convention,
    ) as batch_op:
        batch_op.alter_column('room_id', existing_type=sa.INTEGER(), nullable=True)
        batch_op.drop_constraint(
            'fk_stakeholder_competency_evaluations_room_id_stakeholder_chat_rooms',
            type_='foreignkey',
        )
        batch_op.create_foreign_key(
            'fk_competency_eval_room_id',
            'stakeholder_chat_rooms',
            ['room_id'],
            ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    """Revert room_id FK back to CASCADE and NOT NULL."""
    with op.batch_alter_table(
        'stakeholder_competency_evaluations',
        naming_convention=naming_convention,
    ) as batch_op:
        batch_op.drop_constraint('fk_competency_eval_room_id', type_='foreignkey')
        batch_op.create_foreign_key(
            'fk_competency_eval_room_id',
            'stakeholder_chat_rooms',
            ['room_id'],
            ['id'],
            ondelete='CASCADE',
        )
        batch_op.alter_column('room_id', existing_type=sa.INTEGER(), nullable=False)
