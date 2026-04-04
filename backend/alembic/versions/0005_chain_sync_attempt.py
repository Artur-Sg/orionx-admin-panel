"""chain last sync attempt

Revision ID: 0005_chain_sync_attempt
Revises: 0004_chain_sync_status
Create Date: 2026-04-05 13:10:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_chain_sync_attempt"
down_revision = "0004_chain_sync_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chains", sa.Column("last_sync_attempt_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("chains", "last_sync_attempt_at")
