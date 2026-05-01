"""add encrypted value for api keys

Revision ID: 0009_api_keys_encrypted
Revises: 0008_api_keys_drop_legacy
Create Date: 2026-05-02 12:20:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0009_api_keys_encrypted"
down_revision = "0008_api_keys_drop_legacy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("api_keys", sa.Column("key_encrypted", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("api_keys", "key_encrypted")
