"""chains and user_chain_access

Revision ID: 0002_chains
Revises: 0001_init
Create Date: 2026-04-04 17:10:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_chains"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chains",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("visibility", sa.String(length=32), nullable=False, server_default=sa.text("'private'")),
        sa.Column("rpc_target_url", sa.String(length=512), nullable=False),
        sa.Column("description", sa.String(length=1024), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )
    op.create_index("ux_chains_code", "chains", ["code"], unique=True)

    op.create_table(
        "user_chain_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'active'")),
        sa.Column("quota_total", sa.Integer(), nullable=True),
        sa.Column("quota_used", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("granted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_chain_access_user"),
        sa.ForeignKeyConstraint(["chain_id"], ["chains.id"], name="fk_user_chain_access_chain"),
    )
    op.create_index("ix_user_chain_access_user", "user_chain_access", ["user_id"])
    op.create_index("ix_user_chain_access_chain", "user_chain_access", ["chain_id"])


def downgrade() -> None:
    op.drop_index("ix_user_chain_access_chain", table_name="user_chain_access")
    op.drop_index("ix_user_chain_access_user", table_name="user_chain_access")
    op.drop_table("user_chain_access")
    op.drop_index("ux_chains_code", table_name="chains")
    op.drop_table("chains")
