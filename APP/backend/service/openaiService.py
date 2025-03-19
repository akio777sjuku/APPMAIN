import os
import openai
from tenacity import retry, stop_after_attempt, wait_random_exponential

AZURE_OPENAI_EMB_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
AZURE_OPENAI_SERVICE = os.getenv("AZURE_OPENAI_SERVICE")
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHATGPT_DEPLOYMENT")
AZURE_OPENAI_CHATGPT_MODEL = os.getenv("AZURE_OPENAI_CHATGPT_MODEL")
AZURE_OPENAI_EMB_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")

class OpenaiService():

    def __init__(self):
        self.embedding_deployment = AZURE_OPENAI_EMB_DEPLOYMENT
        openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
        openai.api_version = "2023-05-15"
        openai.api_type = "azure"
        openai.api_key = AZURE_OPENAI_KEY

    def before_retry_sleep(self):
        print("Rate limited on the OpenAI embeddings API, sleeping before retrying...")

    @retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(15), before_sleep=before_retry_sleep)
    def compute_embedding(self, text):
        # refresh_openai_token()
        res =openai.Embedding.create(engine=self.embedding_deployment, input=text)
        return res["data"][0]["embedding"]
