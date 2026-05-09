from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration"""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        protected_namespaces=("settings_",),
    )
    
    # Featherless AI
    featherless_api_key: str = "mock_key_replace_with_yours"
    featherless_base_url: str = "https://api.featherless.ai/v1"
    model_name: str = "Qwen/Qwen2.5-7B-Instruct"
    
    # Database
    database_url: str = "sqlite:///./forensiai.db"
    sql_echo: bool = False
    
    # Upload
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 50
    
    # Environment
    env: str = "development"
    debug: bool = True
    frontend_url: str = "http://localhost:3000"


settings = Settings()
