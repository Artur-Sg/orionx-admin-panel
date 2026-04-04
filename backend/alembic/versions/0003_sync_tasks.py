"""sync tasks outbox

Revision ID: 0003_sync_tasks
Revises: 0002_chains
Create Date: 2026-04-05 10:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_sync_tasks"
down_revision = "0002_chains"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sync_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("task_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_error", sa.String(length=2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )
    op.create_index("ix_sync_tasks_status", "sync_tasks", ["status"])
    op.create_index("ix_sync_tasks_type", "sync_tasks", ["task_type"])


def downgrade() -> None:
    op.drop_index("ix_sync_tasks_type", table_name="sync_tasks")
    op.drop_index("ix_sync_tasks_status", table_name="sync_tasks")
    op.drop_table("sync_tasks")
