
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
ユーザーの入力文書を下記内容によって校正してください。
１．表記・表現の間違い、不適切な表現の検出
２．わかりやすい表記にするための提案
３．文書をよりよくするための提案
４．誤字・脱字、タイプミスの修正
５．読みやすくしてください
"""


def proofreading(text):
    response = openai.ChatCompletion.create(
        deployment_id=AZURE_OPENAI_CHATGPT_DEPLOYMENT,
        messages=[
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0,
    )
    return {"answer": response.choices[0].message.content}
