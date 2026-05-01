"""api keys chain and quota fields

Revision ID: 0007_api_keys_chain_quota
Revises: 0006_api_keys
Create Date: 2026-05-01 15:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_api_keys_chain_quota"
down_revision = "0006_api_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("api_keys", sa.Column("chain_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("api_keys", sa.Column("quota_total", sa.Integer(), nullable=True))
    op.add_column("api_keys", sa.Column("quota_used", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.create_index("ix_api_keys_chain_id", "api_keys", ["chain_id"])
    op.create_foreign_key("fk_api_keys_chain", "api_keys", "chains", ["chain_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_api_keys_chain", "api_keys", type_="foreignkey")
    op.drop_index("ix_api_keys_chain_id", table_name="api_keys")
    op.drop_column("api_keys", "quota_used")
    op.drop_column("api_keys", "quota_total")
    op.drop_column("api_keys", "chain_id")
