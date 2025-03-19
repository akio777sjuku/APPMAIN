import io
import logging
import mimetypes
import os
import aiofiles
import aiohttp
import openai
import json
from io import BytesIO
from azure.identity.aio import DefaultAzureCredential
from azure.core.credentials import AzureKeyCredential
from azure.monitor.opentelemetry import configure_azure_monitor
from azure.search.documents.aio import SearchClient
from azure.storage.blob.aio import BlobServiceClient
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from quart import (
    Blueprint,
    Quart,
    abort,
    current_app,
    jsonify,
    request,
    send_file,
    send_from_directory,
)
from dotenv import load_dotenv

from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from approaches.readdecomposeask import ReadDecomposeAsk
from approaches.readretrieveread import ReadRetrieveReadApproach
from approaches.retrievethenread import RetrieveThenReadApproach
from model.fileApproach import FileApproach
from model.retrieveChatApproach import RetrieveChatApproach
from model.translateApproach import translate
from model.proofreadingApproach import proofreading
from model.gptChatApproach import gptChat
from service.cosmosdbService import CosmosdbService
from service.cognitiveSearchService import CognitiveSearchService
from service.openaiService import OpenaiService
from service.blobStorageService import BlobStorageService
from service.formRecognizerService import FormRecognizerService
from service.redisService import RedisService


load_dotenv()

# Replace these with your own values, either in environment variables or directly here
# Azure Blob Storage
AZURE_STORAGE_ACCOUNT = os.getenv("AZURE_STORAGE_ACCOUNT")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER")
AZURE_STORAGE_KEY = os.getenv("AZURE_STORAGE_KEY")
# Azure Cognitive Search
AZURE_SEARCH_SERVICE = os.getenv("AZURE_SEARCH_SERVICE")
AZURE_SEARCH_INDEX = os.getenv("AZURE_SEARCH_INDEX")
AZURE_SEARCH_KEY = os.getenv("AZURE_SEARCH_KEY")
# Azure Open AI
AZURE_OPENAI_SERVICE = os.getenv("AZURE_OPENAI_SERVICE")
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHATGPT_DEPLOYMENT")
AZURE_OPENAI_CHATGPT_MODEL = os.getenv("AZURE_OPENAI_CHATGPT_MODEL")
AZURE_OPENAI_EMB_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")
# Azure Cosmos DB
AZURE_COSMOSDB_URI = os.getenv("AZURE_COSMOSDB_URI")
AZURE_COSMOSDB_KEY = os.getenv("AZURE_COSMOSDB_KEY")
AZURE_COSMOSDB_DATABASE = os.getenv("AZURE_COSMOSDB_DATABASE")
# Azure form recognizer
AZURE_FORMRECOGNIZER_SERVICE = os.getenv("AZURE_FORMRECOGNIZER_SERVICE")
AZURE_FORMRECOGNIZER_KEY = os.getenv("AZURE_FORMRECOGNIZER_KEY")
# Azure Cognitive Search Index
KB_FIELDS_CONTENT = os.getenv("KB_FIELDS_CONTENT")
KB_FIELDS_CATEGORY = os.getenv("KB_FIELDS_CATEGORY")
KB_FIELDS_SOURCEPAGE = os.getenv("KB_FIELDS_SOURCEPAGE")

APPLICATIONINSIGHTS_CONNECTION_STRING = os.getenv(
    "APPLICATIONINSIGHTS_CONNECTION_STRING")

# CONFIG_OPENAI_TOKEN = "openai_token"
CONFIG_CREDENTIAL = "azure_credential"
CONFIG_ASK_APPROACHES = "ask_approaches"
CONFIG_CHAT_APPROACHES = "chat_approaches"
CONFIG_BLOB_CLIENT = "blob_client"
CONFIG_COSMOSDB_SERVICE = "CosmosdbService"
CONFIG_SEARCH_SERVICE = "CognitiveSearchService"
CONFIG_OPENAI_SERVICE = "OpenaiService"
CONFIG_BLOBSTORAGE_SERVICE = "BlobStorageService"
CONFIG_FORMRECOGNIZER_SERVICE = "FormRecognizerService"
CONFIG_REDIS_SERVICE = "RedisService"

bp = Blueprint("routes", __name__, static_folder='static')


@bp.route("/")
async def index():
    return await bp.send_static_file("index.html")


@bp.route("/")
async def main():
    return await bp.send_static_file("index.html")


@bp.route("/favicon.ico")
async def favicon():
    return await bp.send_static_file("favicon.ico")


@bp.errorhandler(404)
async def page_not_found(e):
    return await bp.send_static_file("index.html")


@bp.route("/assets/<path:path>")
async def assets(path):
    return await send_from_directory("static/assets", path)


@bp.route("/auth_setup", methods=["GET"])
def auth_setup():
    res = {
        "auth": {
            "clientId": os.getenv("AZURE_CLIENT_APP_ID"),
            "authority": os.getenv("AZURE_AUTHORITY"),
            "redirectUri": os.getenv("AZURE_REDIRECT_URL"),
        },
        "cache": {
            "cacheLocation": "sessionStorage",
            "storeAuthStateInCookie": False,
        },
    }
    return jsonify(res)


@bp.route("/content/<path>")
async def content_file(path):
    blob_container = current_app.config[CONFIG_BLOB_CLIENT].get_container_client(
        AZURE_STORAGE_CONTAINER)
    blob = await blob_container.get_blob_client(path).download_blob()
    if not blob.properties or not blob.properties.has_key("content_settings"):
        abort(404)
    mime_type = blob.properties["content_settings"]["content_type"]
    if mime_type == "application/octet-stream":
        mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    blob_file = io.BytesIO()
    await blob.readinto(blob_file)
    blob_file.seek(0)
    return await send_file(blob_file, mimetype=mime_type, as_attachment=False, attachment_filename=path)


@bp.route("/ask", methods=["POST"])
async def ask():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    approach = request_json["approach"]
    try:
        impl = current_app.config[CONFIG_ASK_APPROACHES].get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        # Workaround for: https://github.com/openai/openai-python/issues/371
        async with aiohttp.ClientSession() as s:
            openai.aiosession.set(s)
            r = await impl.run(request_json["question"], request_json.get("overrides") or {})
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /ask")
        return jsonify({"error": str(e)}), 500


@bp.route("/qaanswer", methods=["POST"])
async def qachat():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    approach = request_json["approach"]
    chat_id = request_json["chatid"]
    openai_model = request_json["openaimodel"]
    try:
        impl = current_app.config[CONFIG_CHAT_APPROACHES].get(approach)
        cosmosdbService: CosmosdbService = current_app.config["CosmosdbService"]
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        async with aiohttp.ClientSession() as s:
            openai.aiosession.set(s)
            r = await impl.run(request_json["history"], request_json.get("overrides") or {}, openai_model)
        history: list[dict[str, str]] = request_json["history"]
        if len(history) == 1:
            chat_name = history[-1]["user"][0:10] if len(
                history[-1]["user"]) > 10 else history[-1]["user"]
            cosmosdbService.update_chat(chat_id, chat_name, openai_model)
        cosmosdbService.add_chat_content(chat_id=chat_id, chat_type="qa", index=len(
            history), question=history[-1]["user"], answer=r)
        return jsonify(r), 200
    except Exception as e:
        logging.exception("Exception in /qaanswer")
        return jsonify({"error": str(e)}), 500


@bp.route("/retrievechat", methods=["POST"])
async def RetrieveChat():
    request_data = await request.form
    request_files = await request.files
    cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]
    retrieveChatApproach = RetrieveChatApproach()
    try:
        history: list[dict[str, str]] = json.loads(request_data["history"])
        chatId = request_data["chatid"]
        openaiModel = request_data["openaimodel"]
        # ファイルが存在する時。
        if len(request_files) > 0:
            retrieveChatApproach.uploadFile(chatId, request_files)
        # URLチェック
        urls = retrieveChatApproach.checkURL(history[-1]["user"])
        if (len(urls) > 0):
            retrieveChatApproach.uploadURL(chatId, urls)
        res = retrieveChatApproach.chat(chatId, history, openaiModel)
        if len(history) == 1:
            chat_name = history[-1]["user"][0:10] if len(
                history[-1]["user"]) > 10 else history[-1]["user"]
            cosmosdbService.update_chat(chatId, chat_name, openaiModel)
        cosmosdbService.add_chat_content(chat_id=chatId, chat_type="retrieve", index=len(
            history), question=history[-1]["user"], answer=res)
        return jsonify(res), 200
    except Exception as e:
        logging.exception("Exception in /retrievechat")
        return jsonify({"error": str(e)}), 500


@bp.route("/gptanswer", methods=["POST"])
async def GptAnswer():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]
    try:
        history = request_json["history"]
        chatId = request_json["chatid"]
        openaiModel = request_json["openaimodel"]
        # 質問回答
        res = gptChat(chatId, history, openaiModel)
        cosmosdbService.add_chat_content(chat_id=chatId, chat_type="gpt", index=len(
            history), question=history[-1]["user"], answer=res)
        if len(history) == 1:
            chat_name = history[-1]["user"][0:10] if len(
                history[-1]["user"]) > 10 else history[-1]["user"]
            cosmosdbService.update_chat(chatId, chat_name, openaiModel)
        return jsonify(res), 200
    except Exception as e:
        logging.exception("Exception in /gptanswer")
        return jsonify({"error": str(e)}), 500


@bp.route("/api/translatetext", methods=["POST"])
async def translateText():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        translatetext = request_json["translatetext"]
        res = translate(translatetext)
        return jsonify(res), 200
    except Exception as e:
        logging.exception("Exception in /retrievechat")
        return jsonify({"error": str(e)}), 500


@bp.route("/api/proofreadingtext", methods=["POST"])
async def proofreadingText():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        proofreadingtext = request_json["proofreadingtext"]
        res = proofreading(proofreadingtext)
        return jsonify(res), 200
    except Exception as e:
        logging.exception("Exception in /retrievechat")
        return jsonify({"error": str(e)}), 500


@bp.route("/api/chatcontent", methods=["POST"])
async def chatContent():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        chat_id = request_json["chat_id"]
        chat_type = request_json["chat_type"]
        cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]
        res = cosmosdbService.get_chat_content(chat_id)
        return jsonify(res), 200
    except Exception as e:
        logging.exception("Exception in /chatcontent")
        return jsonify({"error": str(e)}), 500


@bp.route("/api/chatlist", methods=["POST"])
async def chatLists():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    user_name = request_json["user_name"]
    chat_type = request_json["chat_type"]
    try:
        cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]
        res = cosmosdbService.get_chat_list(user_name, chat_type)
        return jsonify(res), 200
    except Exception as e:
        logging.exception("Exception in /chatlist")
        return jsonify({"error": str(e)}), 500


@bp.route("/api/chat", methods=["POST", "PUT", "GET", "DELETE"])
async def chat():
    cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]
    if request.method == 'GET':
        try:
            chat_id = request.args.get('chat_id')
            res = cosmosdbService.get_chat(chat_id)
            return jsonify(res), 200
        except Exception as e:
            logging.exception("Exception in /api/chat")
            return jsonify({"error": str(e)}), 500
    else:
        if not request.is_json:
            return jsonify({"error": "request must be json"}), 415
        request_json = await request.get_json()
        chat_id = request_json["chat_id"]
        user_name = request_json["user_name"]
        chat_name = request_json["chat_name"]
        chat_type = request_json["chat_type"]
        try:
            if request.method == 'POST':
                chatObj = cosmosdbService.create_chat(
                    user_name, chat_name, chat_type)
                return jsonify(chatObj), 200
            elif request.method == "PUT":
                cosmosdbService.update_chat_name(chat_id, chat_name)
                return jsonify(""), 200
            elif request.method == "DELETE":
                cosmosdbService.delete_chat_and_content(chat_id)
                if (chat_type == "retrieve"):
                    redisService: RedisService = current_app.config[CONFIG_REDIS_SERVICE]
                    redisService.delete_by_chatid(chat_id)
                return jsonify(""), 200
            else:
                raise ValueError("Unknow the option")
        except Exception as e:
            logging.exception("Exception in /chat")
            return jsonify({"error": str(e)}), 500


@bp.route("/api/enterprisefile", methods=["GET", "POST", "DELETE"])
async def enterprise_file():
    if request.method == 'GET':
        try:
            cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]
            file_name = request.args.get('file_name')
            folder_id = request.args.get('folder_id')
            tag = request.args.get('tag')
            created_user = request.args.get('created_user')
            res = cosmosdbService.get_file_infos(
                file_name, folder_id, tag, created_user)
            return jsonify(res), 200
        except Exception as e:
            logging.exception("Exception in /fileinfolist")
            return jsonify({"error": str(e)}), 500
    elif request.method == 'POST':
        ENTERPRISE_FOLDER = 'enterprise_data'
        if not os.path.exists(ENTERPRISE_FOLDER):
            os.makedirs(ENTERPRISE_FOLDER)

        if 'file' not in await request.files:
            return jsonify({'error': 'No file part'}), 400

        file = (await request.files)['file']

        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        if file:
            file_path = os.path.join(ENTERPRISE_FOLDER, file.filename)
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(file.read())
                try:
                    file_type = os.path.splitext(file_path)[1].lower()
                    if file_type not in [".pdf", ".docx", ".csv", ".txt", ".xlsx"]:
                        return jsonify({"error": "csv、xlsx、docx、pdf、txt 以外のファイルを解析できません。"}), 500
                    request_data = await request.form
                    created_user = request_data["created_user"]
                    folder_id = request_data["folder_id"]
                    tag = request_data["tag"]

                    FileApproach().process_enterprise_file(file_path, created_user, folder_id, tag)
                except Exception as e:
                    logging.exception("Exception in /enterprisefile")
                    return jsonify({"error": str(e)}), 500
            return jsonify({'success': True, 'filename': file.filename}), 200
    elif request.method == 'DELETE':
        if not request.is_json:
            return jsonify({"error": "request must be json"}), 415
        request_json = await request.get_json()
        file_id = request_json["fileid"]
        file_name = request_json["filename"]
        try:
            FileApproach().delete_enterprise_file(id=file_id, filename=file_name)
            return jsonify({'success': True}), 200
        except Exception as e:
            logging.exception("Exception in /enterprisefile")
            return jsonify({"error": str(e)}), 500


@bp.route("/api/downloadEnterpriseFile", methods=["GET"])
async def downloadEnterpriseFile():
    try:
        blobStorageService: BlobStorageService = current_app.config[CONFIG_BLOBSTORAGE_SERVICE]
        file_name = request.args.get('file_name')
        file_id = request.args.get('file_id')
        if not file_name or not file_id:
            return jsonify({"error": "file_name and file_id are required"}), 400
        data = blobStorageService.get_blob(file_id)
        return await send_file(BytesIO(data.readall()), as_attachment=True, attachment_filename=file_name)
    except Exception as e:
        logging.exception("Exception in downloadEnterpriseFile")
        return jsonify({"error": str(e)}), 500


@bp.route("/api/userlogininfo", methods=["POST", "GET"])
async def user_login_info():
    cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]

    if request.method == 'GET':
        try:
            user_id = request.args.get('user_id')
            user_login_info = cosmosdbService.get_user_login_info(user_id)
            return jsonify(user_login_info), 200
        except Exception as e:
            logging.exception("Exception in get/userlogininfo")
            return jsonify({"error": str(e)}), 500
    elif request.method == 'POST':
        if not request.is_json:
            return jsonify({"error": "request must be json"}), 415
        request_json = await request.get_json()
        try:
            res = cosmosdbService.insert_user_login_info(request_json)
            return jsonify(res), 200
        except Exception as e:
            logging.exception("Exception in post/userlogininfo")
            return jsonify({"error": str(e)}), 500


@bp.route("/api/folder", methods=["POST", "GET"])
async def folder():
    cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]
    if request.method == 'GET':
        try:
            folders = cosmosdbService.get_folders()
            return jsonify(folders), 200
        except Exception as e:
            logging.exception("Exception in get/folder")
            return jsonify({"error": str(e)}), 500
    elif request.method == 'POST':
        if not request.is_json:
            return jsonify({"error": "request must be json"}), 415
        request_json = await request.get_json()
        try:
            folder_name = request_json['foldername']
            user_name = request_json['username']
            res = cosmosdbService.insert_folder(folder_name, user_name)
            return jsonify(res), 200
        except Exception as e:
            logging.exception("Exception in post/folder")
            return jsonify({"error": str(e)}), 500


@bp.route("/api/authentication", methods=["POST", "PUT", "GET", "DELETE"])
async def authentication():
    cosmosdbService: CosmosdbService = current_app.config[CONFIG_COSMOSDB_SERVICE]
    try:
        if request.method == 'GET':
            if request.args.get('user_id'):
                res = cosmosdbService.get_user_info(
                    request.args.get('user_id'))
                if len(res) == 0:
                    res.append({"user_id": request.args.get('user_id'),
                                "authentication": {
                                    "admin": "no",
                                    "file_upload": "no",
                                    "openai_model": ["gpt-35-turbo"]
                    }})
                return jsonify(res), 200
            else:
                res = cosmosdbService.get_user_info()
                return jsonify(res), 200

        elif request.method == 'POST':
            if not request.is_json:
                return jsonify({"error": "request must be json"}), 415
            request_json = await request.get_json()
            user_id = request_json['user_id']
            res = cosmosdbService.get_user_info(user_id)
            if (len(res) > 0):
                return jsonify({"error": "対象IDは既に存在しています。"}), 200
            else:
                id = cosmosdbService.create_user_info(request_json)
                return jsonify({"id": id}), 200

        elif request.method == 'PUT':
            if not request.is_json:
                return jsonify({"error": "request must be json"}), 415
            request_json = await request.get_json()
            cosmosdbService.update_user_info(request_json)
            return jsonify({"success": True}), 200

        elif request.method == 'DELETE':
            if request.args.get('user_info_id'):
                cosmosdbService.delete_user_info(
                    request.args.get('user_info_id'))
                return jsonify({'success': True}), 200
            else:
                return jsonify({"error": "miss reauest parameter"}), 415
    except Exception as e:
        logging.exception("Exception in post/folder")
        return jsonify({"error": str(e)}), 500


@bp.before_app_serving
async def setup_clients():

    # Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed,
    # just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the
    # keys for each service
    # If you encounter a blocking error during a DefaultAzureCredential resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
    azure_credential = DefaultAzureCredential(
        exclude_shared_token_cache_credential=True)

    # Set up clients for Cognitive Search and Storage
    search_client = SearchClient(
        endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
        index_name=AZURE_SEARCH_INDEX,
        credential=AzureKeyCredential(AZURE_SEARCH_KEY))

    blob_client = BlobServiceClient(
        account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net",
        credential=AZURE_STORAGE_KEY)

    # Used by the OpenAI SDK
    openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
    openai.api_version = "2023-05-15"
    openai.api_type = "azure"
    openai.api_key = AZURE_OPENAI_KEY
    os.environ["OPENAI_API_TYPE"] = "azure"
    os.environ["OPENAI_API_BASE"] = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
    os.environ["OPENAI_API_KEY"] = AZURE_OPENAI_KEY
    os.environ["OPENAI_API_VERSION"] = "2023-05-15"

    # Store on app.config for later use inside requests
    # current_app.config[CONFIG_OPENAI_TOKEN] = openai_token
    current_app.config[CONFIG_CREDENTIAL] = azure_credential
    current_app.config[CONFIG_BLOB_CLIENT] = blob_client
    # Various approaches to integrate GPT and external knowledge, most applications will use a single one of these patterns
    # or some derivative, here we include several for exploration purposes
    current_app.config[CONFIG_ASK_APPROACHES] = {
        "rtr": RetrieveThenReadApproach(
            search_client,
            AZURE_OPENAI_CHATGPT_DEPLOYMENT,
            AZURE_OPENAI_CHATGPT_MODEL,
            AZURE_OPENAI_EMB_DEPLOYMENT,
            KB_FIELDS_SOURCEPAGE,
            KB_FIELDS_CONTENT
        ),
        "rrr": ReadRetrieveReadApproach(
            search_client,
            AZURE_OPENAI_CHATGPT_DEPLOYMENT,
            AZURE_OPENAI_EMB_DEPLOYMENT,
            KB_FIELDS_SOURCEPAGE,
            KB_FIELDS_CONTENT
        ),
        "rda": ReadDecomposeAsk(
            search_client,
            AZURE_OPENAI_CHATGPT_DEPLOYMENT,
            AZURE_OPENAI_EMB_DEPLOYMENT,
            KB_FIELDS_SOURCEPAGE,
            KB_FIELDS_CONTENT
        )
    }
    current_app.config[CONFIG_CHAT_APPROACHES] = {
        "rrr": ChatReadRetrieveReadApproach(
            search_client,
            AZURE_OPENAI_CHATGPT_DEPLOYMENT,
            AZURE_OPENAI_CHATGPT_MODEL,
            AZURE_OPENAI_EMB_DEPLOYMENT,
            KB_FIELDS_SOURCEPAGE,
            KB_FIELDS_CONTENT,
        )
    }
    # service
    current_app.config[CONFIG_COSMOSDB_SERVICE] = CosmosdbService()
    current_app.config[CONFIG_OPENAI_SERVICE] = OpenaiService()
    current_app.config[CONFIG_SEARCH_SERVICE] = CognitiveSearchService()
    current_app.config[CONFIG_BLOBSTORAGE_SERVICE] = BlobStorageService()
    current_app.config[CONFIG_FORMRECOGNIZER_SERVICE] = FormRecognizerService()
    current_app.config[CONFIG_REDIS_SERVICE] = RedisService()


def create_app():
    if APPLICATIONINSIGHTS_CONNECTION_STRING:
        configure_azure_monitor()
        AioHttpClientInstrumentor().instrument()
    app = Quart(__name__)
    app.register_blueprint(bp)
    app.asgi_app = OpenTelemetryMiddleware(app.asgi_app)
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1000 * 1000

    return app
