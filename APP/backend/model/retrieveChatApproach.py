import os
import re
import tempfile
from quart import current_app
from langchain.chat_models import AzureChatOpenAI
from langchain.chains import ConversationalRetrievalChain
from langchain.document_loaders.csv_loader import CSVLoader
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.document_loaders import PyPDFLoader
from langchain.document_loaders import TextLoader
from langchain.document_loaders import WebBaseLoader
from langchain.document_loaders import UnstructuredExcelLoader
from langchain.document_loaders import UnstructuredWordDocumentLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores.redis import Redis
from langchain.vectorstores.redis import RedisText
from langchain.memory import ChatMessageHistory
from langchain.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from service.blobStorageService import BlobStorageService
from constants.constants import OPENAI_MODEL

AZURE_OPENAI_EMB_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
AZURE_OPENAI_SERVICE = os.getenv("AZURE_OPENAI_SERVICE")
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHATGPT_DEPLOYMENT")
AZURE_OPENAI_CHATGPT_MODEL = os.getenv("AZURE_OPENAI_CHATGPT_MODEL")
AZURE_OPENAI_EMB_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")
AZURE_SEARCH_SERVICE = os.getenv("AZURE_SEARCH_SERVICE")
AZURE_SEARCH_KEY = os.getenv("AZURE_SEARCH_KEY")
REDIS_URL = os.getenv("REDIS_URL")
REDIS_KEY = os.getenv("REDIS_KEY")
REDIS_INDEX_NAME = os.getenv("REDIS_INDEX_NAME")
AZURE_REDIS_URL = "rediss://:" + REDIS_KEY + "@" + REDIS_URL


CHAT_PROMPT = """資料と会話履歴を基づいて、最後の質問を答えってください。 
答えがわからない場合は、わからないと言ってください。 答えをでっち上げようとしないでください。 
ユーザーに明確な質問をすることが役立つ場合は、質問してください。答えは簡潔にしてください。
答えは日本語で質問が文脈に関連していない場合は、文脈に関連する質問のみに答えるように調整していることを丁寧に答えてください。 
返信するときは、できるだけ詳細を記載してください。
資料:{context}
"""


class RetrieveChatApproach():
    def __init__(self):
        self.blobStorageService: BlobStorageService = current_app.config["BlobStorageService"]
        self.prompt = ChatPromptTemplate(
            messages=[
                SystemMessagePromptTemplate.from_template(CHAT_PROMPT),
                HumanMessagePromptTemplate.from_template("質問:{question}")
            ]
        )

    def chat(self, chatId, history, openaiModel):
        question = history[-1]["user"]
        chat_history = ChatMessageHistory()
        if (len(history[:-1]) > 0):
            for h in reversed(history[:-1]):
                if bot_msg := h.get("bot"):
                    chat_history.add_ai_message(bot_msg)
                if user_msg := h.get("user"):
                    chat_history.add_user_message(user_msg)
        chain_input = {"question": question,
                       "chat_history": chat_history.messages}
        
        embeddings: OpenAIEmbeddings = OpenAIEmbeddings(
            deployment=AZURE_OPENAI_EMB_DEPLOYMENT, chunk_size=1)
        # seach the redis data
        rds = Redis.from_existing_index(
            embeddings,
            index_name=REDIS_INDEX_NAME,
            redis_url=AZURE_REDIS_URL,
            schema="redis_schema.yaml"
        )
        chat_id_filter = RedisText("chat_id") == chatId.replace("-", "")
        retriever = rds.as_retriever(search_type="similarity",
                                     search_kwargs={"k": 10, 'filter': chat_id_filter})

        if (not openaiModel) or (openaiModel.strip() == ""):
            openaiModel = "gpt-35-turbo"
        model_info = OPENAI_MODEL[openaiModel]
        print(model_info)
        llm = AzureChatOpenAI(
            deployment_name=model_info["deployment"], model_name=model_info["model"])
        

        chain = ConversationalRetrievalChain.from_llm(llm=llm,
                                                      retriever=retriever,
                                                      max_tokens_limit=model_info["maxtoken"],
                                                      combine_docs_chain_kwargs={
                                                          "prompt": self.prompt},
                                                      verbose=True,
                                                      return_source_documents=True)

        result = chain(chain_input)
        return {"answer": result["answer"]}
    
    def uploadFile(self, chat_id, files):
        for i in range(len(files)):
            file_key = f"file{i}"
            file = files.get(file_key)
            documents = self.loadFile(file)
            self.storeDocEmbeds(documents, chat_id, file.filename)

    def checkURL(self, content):
        # URLの正規表現パターン
        url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        # 正規表現でURLを検出
        urls = re.findall(url_pattern, content)
        return urls

    def uploadURL(self, chat_id, urls):
        for url in urls:
            loader = WebBaseLoader(url)
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=200,
                chunk_overlap=10,
                length_function=len,
            )
            documents = loader.load_and_split(text_splitter)
            self.storeDocEmbeds(documents, chat_id, url)

    def storeDocEmbeds(self, documents, chat_id: str, resource):
        """
        Stores document embeddings using Langchain and redis
        """
        if documents:
            for document in documents:
                document.metadata["chat_id"] = chat_id.replace("-", "")
                document.metadata["resource"] = resource

            embeddings: OpenAIEmbeddings = OpenAIEmbeddings(
                deployment=AZURE_OPENAI_EMB_DEPLOYMENT, chunk_size=1)
            rds = Redis.from_documents(
                documents,
                embeddings,
                redis_url=AZURE_REDIS_URL,
                index_name=REDIS_INDEX_NAME
            )
            # write the schema to a yaml file
            # rds.write_schema("redis_schema.yaml")

    def loadFile(self, file):

        original_filename = file.filename
        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as tmp_file:
            tmp_file.write(file.read())
            tmp_file_path = tmp_file.name

        def get_file_extension(uploaded_file):
            file_extension = os.path.splitext(uploaded_file)[1].lower()
            return file_extension

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            length_function=len,
        )

        file_extension = get_file_extension(original_filename)
        try:
            if file_extension == ".csv":
                loader = CSVLoader(file_path=tmp_file_path, encoding="utf-8", csv_args={
                    'delimiter': ',', })
                documents = loader.load()
            elif file_extension == ".xlsx":
                loader = UnstructuredExcelLoader(
                    file_path=tmp_file_path, mode="elements")
                documents = loader.load_and_split(text_splitter)

            elif file_extension == ".docx":
                loader = UnstructuredWordDocumentLoader(
                    file_path=tmp_file_path)
                documents = loader.load_and_split(text_splitter)

            elif file_extension == ".pdf":
                loader = PyPDFLoader(file_path=tmp_file_path)
                documents = loader.load_and_split(text_splitter)

            elif file_extension == ".txt":
                loader = TextLoader(file_path=tmp_file_path, encoding="utf-8")
                documents = loader.load_and_split(text_splitter)
            else:
                raise ValueError("csv、xlsx、docx、pdf、txt 以外のファイルを解析できません。") 
        except Exception as e:
            raise e
        finally:
            os.remove(tmp_file_path)
        return documents
