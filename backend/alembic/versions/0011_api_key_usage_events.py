"""add api key usage events table

Revision ID: 0011_api_key_usage_events
Revises: 0010_api_keys_quota_modes
Create Date: 2026-05-02 13:20:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_api_key_usage_events"
down_revision = "0010_api_keys_quota_modes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_key_usage_events",
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("api_key_id", sa.UUID(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["api_key_id"], ["api_keys.id"]),
        sa.PrimaryKeyConstraint("request_id"),
    )
    op.create_index(
        "ix_api_key_usage_events_api_key_id",
        "api_key_usage_events",
        ["api_key_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_api_key_usage_events_api_key_id", table_name="api_key_usage_events")
    op.drop_table("api_key_usage_events")
