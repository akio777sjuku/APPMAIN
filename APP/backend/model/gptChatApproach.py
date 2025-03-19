import logging
import openai
from constants.constants import OPENAI_MODEL

PROMPT = """
問題を簡潔に答えください。
"""


def gptChat(chatId, history, openaiModel):
    logging.info(f"Processing ChatId: {chatId} OpenaiModel: {openaiModel}")

    messages = [
        {"role": "system", "content": PROMPT}]
    for item in history[:-1]:
        messages.append({"role": "user", "content": item["user"]})
        messages.append({"role": "assistant", "content": item["bot"]})

    messages.append({"role": "user", "content": history[-1]["user"]})
    if (not openaiModel) or (openaiModel.strip() == ""):
        openaiModel = "gpt-35-turbo"
    model_info = OPENAI_MODEL[openaiModel]

    response = openai.ChatCompletion.create(
        deployment_id=model_info["deployment"],
        messages=messages,
        temperature=0.7,
    )

    return {"answer": response.choices[0].message.content}
