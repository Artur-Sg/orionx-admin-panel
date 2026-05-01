"""add api key quota mode and window

Revision ID: 0010_api_keys_quota_modes
Revises: 0009_api_keys_encrypted
Create Date: 2026-05-02 12:50:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0010_api_keys_quota_modes"
down_revision = "0009_api_keys_encrypted"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("api_keys", sa.Column("quota_mode", sa.String(length=32), nullable=True))
    op.add_column("api_keys", sa.Column("quota_window_seconds", sa.Integer(), nullable=True))
    op.execute("UPDATE api_keys SET quota_mode = 'monthly' WHERE quota_mode IS NULL")
    op.alter_column("api_keys", "quota_mode", existing_type=sa.String(length=32), nullable=False)


def downgrade() -> None:
    op.drop_column("api_keys", "quota_window_seconds")
    op.drop_column("api_keys", "quota_mode")
