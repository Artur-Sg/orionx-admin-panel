"""drop legacy api keys and enforce chain_id not null

Revision ID: 0008_api_keys_drop_legacy
Revises: 0007_api_keys_chain_quota
Create Date: 2026-05-02 10:15:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_api_keys_drop_legacy"
down_revision = "0007_api_keys_chain_quota"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM api_keys WHERE chain_id IS NULL")
    op.alter_column("api_keys", "chain_id", existing_type=sa.UUID(), nullable=False)


def downgrade() -> None:
    op.alter_column("api_keys", "chain_id", existing_type=sa.UUID(), nullable=True)
