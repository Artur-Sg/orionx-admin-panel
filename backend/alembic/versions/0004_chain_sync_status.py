"""chain sync status fields

Revision ID: 0004_chain_sync_status
Revises: 0003_sync_tasks
Create Date: 2026-04-05 12:30:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_chain_sync_status"
down_revision = "0003_sync_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chains", sa.Column("sync_status", sa.String(length=32), nullable=False, server_default=sa.text("'pending'")))
    op.add_column("chains", sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("chains", sa.Column("sync_error", sa.String(length=2048), nullable=True))


def downgrade() -> None:
    op.drop_column("chains", "sync_error")
    op.drop_column("chains", "synced_at")
    op.drop_column("chains", "sync_status")
