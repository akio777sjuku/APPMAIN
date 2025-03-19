import os
import io
import re
import datetime
from pypdf import PdfReader, PdfWriter
from azure.storage.blob import BlobServiceClient

AZURE_STORAGE_ACCOUNT = os.getenv("AZURE_STORAGE_ACCOUNT")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER")
AZURE_STORAGE_KEY = os.getenv("AZURE_STORAGE_KEY")


class BlobStorageService():

    def __init__(self):
        self.blob_service = BlobServiceClient(
            account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net", credential=AZURE_STORAGE_KEY)
        self.blob_container = self.blob_service.get_container_client(AZURE_STORAGE_CONTAINER)

    def get_blob(self, file_name):
        if self.blob_container.exists():
            blob_client = self.blob_container.get_blob_client(file_name)
            return blob_client.download_blob()
        else:
            raise ValueError("Azure storage にファイルを存在しません。")

    def upload_blobs(self, filename, file_id):

        if not self.blob_container.exists():
            self.blob_container.create_container()

        # if file is PDF split into pages and upload each page as a separate blob
        # if os.path.splitext(filename)[1].lower() == ".pdf":
        #     reader = PdfReader(filename)
        #     pages = reader.pages
        #     for i in range(len(pages)):
        #         blob_name = self.blob_name_from_file_page(filename, i)
        #         print(f"\tUploading blob for page {i} -> {blob_name}")
        #         f = io.BytesIO()
        #         writer = PdfWriter()
        #         writer.add_page(pages[i])
        #         writer.write(f)
        #         f.seek(0)
        #         blob_container.upload_blob(blob_name, f, overwrite=True)
        # blob_name = os.path.basename(filename)

        with open(filename, "rb") as data:
            uploaded_blob = self.blob_container.upload_blob(
                file_id, data, overwrite=True)
        return uploaded_blob.url

    def remove_blobs(self, filename):
        print(f"Removing blobs for '{filename}'")
        if self.blob_container.exists():
            if os.path.splitext(filename)[1].lower() == ".pdf":
                prefix = os.path.splitext(os.path.basename(filename))[0]
                blobs = filter(lambda b: re.match(f"{prefix}-\d+\.pdf", b), self.blob_container.list_blob_names(
                    name_starts_with=os.path.splitext(os.path.basename(prefix))[0]))
                for b in blobs:
                    print(f"\tRemoving blob {b}")
                    self.blob_container.delete_blob(b)
            else:
                self.blob_container.get_blob_client(filename).delete_blob("include")

    def blob_name_from_file_page(self, filename, page=0):
        if os.path.splitext(filename)[1].lower() == ".pdf":
            return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".pdf"
        else:
            return os.path.basename(filename)
