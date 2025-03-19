import os

OPENAI_MODEL = {
    "gpt-35-turbo": {
        "deployment": os.getenv("AZURE_OPENAI_CHATGPT35_DEPLOYMENT"),
        "model": os.getenv("AZURE_OPENAI_CHATGPT35_MODEL"),
        "maxtoken": 4096},
    "gpt-35-turbo-16k": {
        "deployment": os.getenv("AZURE_OPENAI_CHATGPT35_16k_DEPLOYMENT"),
        "model": os.getenv("AZURE_OPENAI_CHATGPT35_16k_MODEL"),
        "maxtoken": 16384},
    "gpt-4": {
        "deployment": os.getenv("AZURE_OPENAI_CHATGPT4_DEPLOYMENT"),
        "model": os.getenv("AZURE_OPENAI_CHATGPT4_MODEL"),
        "maxtoken": 8192},
    "gpt-4-32k": {
        "deployment": os.getenv("AZURE_OPENAI_CHATGPT4_32k_DEPLOYMENT"),
        "model": os.getenv("AZURE_OPENAI_CHATGPT4_32k_MODEL"),
        "maxtoken": 32768}
}

DB_TYPE_CHAT = "chat"
DB_TYPE_CONTENT = "content"
DB_TYPE_USER_INFO = "user-info"
DB_TYPE_LOGIN_HISTORY = "login-history"
DB_TYPE_FILE_INFO = "file-info"
DB_TYPE_FOLDER_INFO = "folder-info"
