"""blockchain_phase4 - make investigator nullable

Revision ID: 002
Revises: 001
Create Date: 2026-04-18

The ORM already maps Case.investigator with a default value so this just
relaxes the NOT NULL constraint so the column survives a re-run without data.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("cases", "investigator", nullable=True)


def downgrade() -> None:
    op.alter_column("cases", "investigator", nullable=False)
