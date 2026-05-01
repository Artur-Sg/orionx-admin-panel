from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "local"
    app_name: str = "orionx-backend"

    database_url: str
    redis_url: str

    jwt_secret: str
    api_key_encryption_secret: str | None = None
    jwt_alg: str = "HS256"
    jwt_access_ttl_min: int = 30
    jwt_refresh_ttl_days: int = 30

    apisix_admin_url: str
    apisix_admin_key: str

    google_client_id: str | None = None

    cors_origins: str = ""

    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()
