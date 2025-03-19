from typing import Any

import openai
from azure.search.documents.aio import SearchClient
from azure.search.documents.models import QueryType

from approaches.approach import ChatApproach
from core.messagebuilder import MessageBuilder
from core.modelhelper import get_token_limit
from text import nonewlines
from constants.constants import OPENAI_MODEL


class ChatReadRetrieveReadApproach(ChatApproach):
    # Chat roles
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"

    """
    Simple retrieve-then-read implementation, using the Cognitive Search and OpenAI APIs directly. It first retrieves
    top documents from search, then constructs a prompt with them, and then uses OpenAI to generate an completion
    (answer) with that prompt.
    """
    system_message_chat_conversation = """あなたはAIアシスタントです。ユーザーの質問を答えます。回答の内容を下記で従い行ってください。
1.回答は簡潔にしてください。
2.以下の情報源のリストに記載されている内容を参照して、回答してください。
3.ユーザーに明確な質問をすることが役立つ場合は、質問してください。
4.表形式の情報の場合は、HTMLテーブルとして返してください。
5.質問が日本語でない場合は、質問で使用されている言語で回答してください。
6.各情報は「ソース名：実際の情報内容」のかたちです、回答は参照する各情報のソース名を含めてください。
7.ソースを参照するには角かっこを使用します。例 [info1.txt]。 ソースを結合せず、各ソースを個別にリストします。 [info1.txt][info2.pdf]。
{follow_up_questions_prompt}
{injected_prompt}
"""
#     follow_up_questions_prompt_content = """Generate three very brief follow-up questions that the user would likely ask next about their healthcare plan and employee handbook.
# Use double angle brackets to reference the questions, e.g. <<Are there exclusions for prescriptions?>>.
# Try not to repeat questions that have already been asked.
# Only generate questions and do not generate any text before or after the questions, such as 'Next Questions'"""
    follow_up_questions_prompt_content = ""

    query_prompt_template = """Below is a history of the conversation so far, and a new question asked by the user that needs to be answered by searching in a knowledge base about employee healthcare plans and the employee handbook.
Generate a search query based on the conversation and the new question.
Do not include cited source filenames and document names e.g info.txt or doc.pdf in the search query terms.
Do not include any text inside [] or <<>> in the search query terms.
Do not include any special characters like '+'.
If the question is not in English, translate the question to English before generating the search query.
If you cannot generate a search query, return just the number 0.
"""
    query_prompt_few_shots = [
        {'role': USER, 'content': 'What are my health plans?'},
        {'role': ASSISTANT, 'content': 'Show available health plans'},
        {'role': USER, 'content': 'does my plan cover cardio?'},
        {'role': ASSISTANT, 'content': 'Health plan cardio coverage'}
    ]

    def __init__(self, search_client: SearchClient, chatgpt_deployment: str, chatgpt_model: str, embedding_deployment: str, sourcepage_field: str, content_field: str):
        self.search_client = search_client
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
        self.embedding_deployment = embedding_deployment
        self.sourcepage_field = sourcepage_field
        self.content_field = content_field
        self.chatgpt_token_limit = get_token_limit(chatgpt_model)

    async def run(self, history: list[dict[str, str]], overrides: dict[str, Any], openaiModel: str) -> Any:
        has_text = overrides.get("retrieval_mode") in ["text", "hybrid", None]
        has_vector = overrides.get("retrieval_mode") in [
            "vectors", "hybrid", None]
        use_semantic_captions = True if overrides.get(
            "semantic_captions") and has_text else False
        top = overrides.get("top") or 3
        exclude_category = overrides.get("exclude_category") or None
        filter = "category ne '{}'".format(
            exclude_category.replace("'", "''")) if exclude_category else None

        user_q = 'Generate search query for: ' + history[-1]["user"]

        if (not openaiModel) or (openaiModel.strip() == ""):
            openaiModel = "gpt-35-turbo"
        model_info = OPENAI_MODEL[openaiModel]

        # STEP 1: Generate an optimized keyword search query based on the chat history and the last question
        messages = self.get_messages_from_history(
            self.query_prompt_template,
            model_info["model"],
            history,
            user_q,
            self.query_prompt_few_shots,
            model_info["maxtoken"] - len(user_q)
        )

        chat_completion = await openai.ChatCompletion.acreate(
            deployment_id=model_info["deployment"],
            model=model_info["model"],
            messages=messages,
            temperature=0.0,
            max_tokens=32,
            n=1)

        query_text = chat_completion.choices[0].message.content
        if query_text.strip() == "0":
            # Use the last user input if we failed to generate a better query
            query_text = history[-1]["user"]

        # STEP 2: Retrieve relevant documents from the search index with the GPT optimized query

        # If retrieval mode includes vectors, compute an embedding for the query
        if has_vector:
            query_vector = (await openai.Embedding.acreate(engine=self.embedding_deployment, input=query_text))["data"][0]["embedding"]
        else:
            query_vector = None

         # Only keep the text query if the retrieval mode uses text, otherwise drop it
        if not has_text:
            query_text = None

        # Use semantic L2 reranker if requested and if retrieval mode is text or hybrid (vectors + text)
        if overrides.get("semantic_ranker") and has_text:
            r = await self.search_client.search(query_text,
                                                filter=filter,
                                                #   query_type=QueryType.SEMANTIC,
                                                query_type=QueryType.SIMPLE,
                                                query_language="en-us",
                                                query_speller="lexicon",
                                                semantic_configuration_name="default",
                                                top=top,
                                                query_caption="extractive|highlight-false" if use_semantic_captions else None,
                                                vector=query_vector,
                                                top_k=50 if query_vector else None,
                                                vector_fields="embedding" if query_vector else None)
        else:
            r = await self.search_client.search(query_text,
                                                filter=filter,
                                                top=top,
                                                vector=query_vector,
                                                top_k=50 if query_vector else None,
                                                vector_fields="embedding" if query_vector else None)
        if use_semantic_captions:
            results = [doc[self.sourcepage_field] + ": " + nonewlines(" . ".join([c.text for c in doc['@search.captions']])) async for doc in r]
        else:
            results = [doc[self.sourcepage_field] + ": " + nonewlines(doc[self.content_field]) async for doc in r]
        content = "\n".join(results)

        follow_up_questions_prompt = self.follow_up_questions_prompt_content if overrides.get(
            "suggest_followup_questions") else ""

        # STEP 3: Generate a contextual and content specific answer using the search results and chat history

        # Allow client to replace the entire prompt, or to inject into the exiting prompt using >>>
        prompt_override = overrides.get("prompt_override")
        if prompt_override is None:
            system_message = self.system_message_chat_conversation.format(
                injected_prompt="", follow_up_questions_prompt=follow_up_questions_prompt)
        elif prompt_override.startswith(">>>"):
            system_message = self.system_message_chat_conversation.format(
                injected_prompt=prompt_override[3:] + "\n", follow_up_questions_prompt=follow_up_questions_prompt)
        else:
            system_message = prompt_override.format(
                follow_up_questions_prompt=follow_up_questions_prompt)

        messages = self.get_messages_from_history(
            system_message,
            model_info["model"],
            history,
            # Model does not handle lengthy system messages well. Moving sources to latest user conversation to solve follow up questions prompt.
            history[-1]["user"] + "\n\nSources:\n" + content,
            max_tokens=model_info["maxtoken"])

        chat_completion = await openai.ChatCompletion.acreate(
            deployment_id=model_info["deployment"],
            model=model_info["model"],
            messages=messages,
            temperature=overrides.get("temperature") or 0.7,
            max_tokens=1024,
            n=1)

        chat_content = chat_completion.choices[0].message.content

        msg_to_display = '\n\n'.join([str(message) for message in messages])

        return {"data_points": results, "answer": chat_content, "thoughts": f"Searched for:<br>{query_text}<br><br>Conversations:<br>" + msg_to_display.replace('\n', '<br>')}

    def get_messages_from_history(self, system_prompt: str, model_id: str, history: list[dict[str, str]], user_conv: str, few_shots=[], max_tokens: int = 4096) -> list:
        message_builder = MessageBuilder(system_prompt, model_id)

        # Add examples to show the chat what responses we want. It will try to mimic any responses and make sure they match the rules laid out in the system message.
        for shot in few_shots:
            message_builder.append_message(
                shot.get('role'), shot.get('content'))

        user_content = user_conv
        append_index = len(few_shots) + 1

        message_builder.append_message(
            self.USER, user_content, index=append_index)

        for h in reversed(history[:-1]):
            if bot_msg := h.get("bot"):
                message_builder.append_message(
                    self.ASSISTANT, bot_msg, index=append_index)
            if user_msg := h.get("user"):
                message_builder.append_message(
                    self.USER, user_msg, index=append_index)
            if message_builder.token_length > max_tokens:
                break

        messages = message_builder.messages
        return messages
