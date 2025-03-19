import os
from uuid import uuid1
from quart import current_app
from service.cognitiveSearchService import CognitiveSearchService
from service.blobStorageService import BlobStorageService
from service.openaiService import OpenaiService
from service.cosmosdbService import CosmosdbService
from upload.uploadFileProcess import UploadFileProcess
from entity.fileInfo import FileInfo, Attributes
from constants import constants


class FileApproach():
    def __init__(self):
        self.cognitiveSearchService: CognitiveSearchService = current_app.config[
            "CognitiveSearchService"]
        self.blobStorageService: BlobStorageService = current_app.config["BlobStorageService"]
        self.openaiService: OpenaiService = current_app.config["OpenaiService"]
        self.cosmosdbService: CosmosdbService = current_app.config["CosmosdbService"]

    def process_enterprise_file(self, file_path, created_user, folder_id, tag):

        print(f"Processing '{file_path}'")
        file_id = str(uuid1())
        blob_url = self.blobStorageService.upload_blobs(file_path, file_id)
        file_info = {
            "file_id": file_id,
            "file_name": os.path.basename(file_path),
            "source": blob_url,
            "size": os.path.getsize(file_path),
            "tag": tag,
            "folder_id": folder_id,
            "created_user": created_user
        }
        self.cosmosdbService.insert_file_info(file_info)

        file_upload_thread = UploadFileProcess(
            file_path, file_id, tag, folder_id)
        file_upload_thread.start()

    def delete_enterprise_file(self, id, filename):
        self.cosmosdbService.delete_file_info(id)
        self.blobStorageService.remove_blobs(id)
        self.cognitiveSearchService.remove_from_index(filename)
