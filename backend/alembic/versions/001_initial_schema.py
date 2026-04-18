"""initial_schema

Revision ID: 001
Revises:
Create Date: 2026-04-18 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cases",
        sa.Column("case_id", sa.String(32), primary_key=True),
        sa.Column("case_number", sa.String(50)),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("started_at", sa.TIMESTAMP()),
        sa.Column("ended_at", sa.TIMESTAMP()),
        sa.Column("investigator", sa.String(255), nullable=False),
        sa.Column("location", sa.String(255)),
        sa.Column("threat_level", sa.String(20)),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("sealed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("blockchain_case_tx_id", sa.String(66)),
    )

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "case_id",
            sa.String(32),
            sa.ForeignKey("cases.case_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("detail", sa.Text()),
        sa.Column("timestamp", sa.TIMESTAMP(), nullable=False),
        sa.Column("sensors", postgresql.JSONB()),
        sa.Column("subject_id", sa.String(10)),
        sa.Column("zone", sa.String(50)),
        sa.Column("confidence", sa.Float()),
        sa.Column("approved", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_events_case_id", "events", ["case_id"])

    op.create_table(
        "reports",
        sa.Column("report_id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "case_id",
            sa.String(32),
            sa.ForeignKey("cases.case_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "generated_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("threat_assessment", postgresql.JSONB()),
        sa.Column("narrative", sa.Text()),
        sa.Column("key_findings", postgresql.JSONB()),
        sa.Column("subject_profiles", postgresql.JSONB()),
        sa.Column("evidence_chain", postgresql.JSONB()),
        sa.Column("recommendation", sa.Text()),
        sa.Column("blockchain_report_hash", sa.String(66)),
        sa.Column("blockchain_report_tx_id", sa.String(66)),
    )
    op.create_index("ix_reports_case_id", "reports", ["case_id"])

    op.create_table(
        "blockchain_records",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("record_type", sa.String(50), nullable=False),
        sa.Column("related_id", sa.String(66), nullable=False),
        sa.Column("tx_hash", sa.String(66), nullable=False),
        sa.Column("block_number", sa.Integer()),
        sa.Column(
            "timestamp",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("metadata", postgresql.JSONB()),
    )
    op.create_index("ix_blockchain_records_related_id", "blockchain_records", ["related_id"])


def downgrade() -> None:
    op.drop_index("ix_blockchain_records_related_id", table_name="blockchain_records")
    op.drop_table("blockchain_records")

    op.drop_index("ix_reports_case_id", table_name="reports")
    op.drop_table("reports")

    op.drop_index("ix_events_case_id", table_name="events")
    op.drop_table("events")

    op.drop_table("cases")
