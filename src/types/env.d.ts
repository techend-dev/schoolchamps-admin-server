declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    NODE_ENV?: string;
    MONGODB_URI: string;
    JWT_SECRET: string;
    WP_BASE_URL: string;
    WP_USER: string;
    WP_APP_PASS: string;
    GEMINI_API_KEY: string;
    MAX_FILE_SIZE?: string;
    UPLOAD_DIR?: string;
  }
}
