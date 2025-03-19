
import os
import openai
from core.messagebuilder import MessageBuilder

AZURE_OPENAI_EMB_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
AZURE_OPENAI_SERVICE = os.getenv("AZURE_OPENAI_SERVICE")
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHATGPT_DEPLOYMENT")
AZURE_OPENAI_CHATGPT_MODEL = os.getenv("AZURE_OPENAI_CHATGPT_MODEL")
AZURE_OPENAI_EMB_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")

PROMPT = """
以下の文章を日本語に翻訳してください。
"""


def translate(translatetext):
    response = openai.ChatCompletion.create(
        deployment_id=AZURE_OPENAI_CHATGPT_DEPLOYMENT,
        messages=[
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": translatetext},
        ],
        temperature=0,
    )

    return {"answer": response.choices[0].message.content}
