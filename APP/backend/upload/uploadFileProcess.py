import threading
import os
import logging

from quart import current_app
from service.cognitiveSearchService import CognitiveSearchService
from service.blobStorageService import BlobStorageService
from service.formRecognizerService import FormRecognizerService
from service.openaiService import OpenaiService
from service.cosmosdbService import CosmosdbService
from langchain.document_loaders import UnstructuredExcelLoader
from langchain.document_loaders import TextLoader
from langchain.document_loaders.csv_loader import CSVLoader
from langchain.document_loaders import UnstructuredWordDocumentLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter


class UploadFileProcess(threading.Thread):

    def __init__(self, file_path, file_id, tag, folder_id):
        self.file_path = file_path
        self.file_id = file_id
        self.tag = tag
        self.folder_id = folder_id
        self.cognitiveSearchService: CognitiveSearchService = current_app.config[
            "CognitiveSearchService"]
        self.blobStorageService: BlobStorageService = current_app.config["BlobStorageService"]
        self.formRecognizerService: FormRecognizerService = current_app.config[
            "FormRecognizerService"]
        self.openaiService: OpenaiService = current_app.config["OpenaiService"]
        self.cosmosdbService: CosmosdbService = current_app.config["CosmosdbService"]
        super().__init__()

    def run(self) -> None:
        try:
            self.cognitiveSearchService.create_search_index()
            page_map = []
            file_type = os.path.splitext(self.file_path)[1].lower()
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=100,
                length_function=len,
            )
            if file_type == ".pdf":
                page_map = self.formRecognizerService.get_document_text(
                    self.file_path)
            elif os.path.splitext(self.file_path)[1].lower() == ".xlsx":
                loader = UnstructuredExcelLoader(
                    file_path=self.file_path, mode="elements")
                docs = loader.load_and_split(text_splitter)
                offset = 0
                for page_content, metadata in docs:
                    page_map.append(
                        (metadata[1]["page_number"], offset, page_content[1]))
                    offset += len(page_content[1])
            elif file_type == ".docx":
                loader = UnstructuredWordDocumentLoader(
                    file_path=self.file_path)
                docs = loader.load_and_split(text_splitter)
                offset = 0
                for idx, content in enumerate(docs):
                    page_map.append((idx, offset, content.page_content))
                    offset += len(content.page_content)
            elif file_type == ".csv":
                loader = CSVLoader(file_path=self.file_path, encoding="utf-8", csv_args={
                    'delimiter': ',', })
                docs = loader.load_and_split(text_splitter)
                offset = 0
                for page_content, metadata in docs:
                    page_map.append(
                        (metadata[1]["row"], offset, page_content[1]))
                    offset += len(page_content[1])
            elif file_type == ".txt":
                loader = TextLoader(file_path=self.file_path, encoding="utf-8")
                docs = loader.load()
                offset = 0
                for idx, content in enumerate(docs):
                    page_map.append(
                        (idx, offset, content.page_content))
                    offset += len(content.page_content)

            if len(page_map) > 0:
                sections = self.cognitiveSearchService.create_sections(page_map, os.path.basename(
                    self.file_path), "enterprise_data", self.tag, self.folder_id)
                self.cognitiveSearchService.index_sections(
                    os.path.basename(self.file_path), sections)
                self.cosmosdbService.update_file_status(
                    self.file_id, "エンベディング処理完了")
        except Exception as e:
            logging.exception(
                "Exception in Upload File Process File_Name: " + self.file_path)
        finally:
            os.remove(self.file_path)
