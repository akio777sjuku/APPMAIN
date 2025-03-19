import os
import re
import base64
import time
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    HnswParameters,
    PrioritizedFields,
    SearchableField,
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SemanticConfiguration,
    SemanticField,
    SemanticSettings,
    SimpleField,
    VectorSearch,
    VectorSearchAlgorithmConfiguration,
)
from quart import current_app

from service.openaiService import OpenaiService

MAX_SECTION_LENGTH = 1000
SENTENCE_SEARCH_LIMIT = 100
SECTION_OVERLAP = 100
AZURE_SEARCH_SERVICE = os.getenv("AZURE_SEARCH_SERVICE")
AZURE_SEARCH_INDEX = os.getenv("AZURE_SEARCH_INDEX")
AZURE_SEARCH_KEY = os.getenv("AZURE_SEARCH_KEY")

# Azure Cognitive Search Index Fields
KB_FIELDS_CONTENT = os.getenv("KB_FIELDS_CONTENT")
KB_FIELDS_CATEGORY = os.getenv("KB_FIELDS_CATEGORY")
KB_FIELDS_SOURCEPAGE = os.getenv("KB_FIELDS_SOURCEPAGE")


class CognitiveSearchService():

    def __init__(self):

        self.search_index_client = SearchClient(endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
                                                index_name=AZURE_SEARCH_INDEX,
                                                credential=AzureKeyCredential(AZURE_SEARCH_KEY))

        self.search_client = SearchIndexClient(endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
                                               credential=AzureKeyCredential(AZURE_SEARCH_KEY))

        self.openai_service: OpenaiService = current_app.config["OpenaiService"]

    def create_search_index(self):
        print(
            f"Ensuring search index {AZURE_SEARCH_INDEX} exists {AZURE_SEARCH_SERVICE}")

        if AZURE_SEARCH_INDEX not in self.search_client.list_index_names():
            index = SearchIndex(
                name=AZURE_SEARCH_INDEX,
                fields=[
                    SimpleField(name="id", type="Edm.String", key=True),
                    SearchableField(name="content", type="Edm.String",
                                    analyzer_name="en.microsoft"),
                    SearchField(name="embedding", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                                hidden=False, searchable=True, filterable=False, sortable=False, facetable=False,
                                vector_search_dimensions=1536, vector_search_configuration="default"),
                    SimpleField(name="category", type="Edm.String",
                                filterable=True, facetable=True),
                    SimpleField(name="sourcepage", type="Edm.String",
                                filterable=True, facetable=True),
                    SimpleField(name="sourcefile", type="Edm.String",
                                filterable=True, facetable=True),
                    SimpleField(name="filetag", type="Edm.String",
                                filterable=True, facetable=True),
                    SimpleField(name="folderid", type="Edm.String",
                                filterable=True, facetable=True),
                ],
                semantic_settings=SemanticSettings(
                    configurations=[SemanticConfiguration(
                        name='default',
                        prioritized_fields=PrioritizedFields(
                            title_field=None, prioritized_content_fields=[SemanticField(field_name='content')]))]),

                vector_search=VectorSearch(
                    algorithm_configurations=[
                        VectorSearchAlgorithmConfiguration(
                            name="default",
                            kind="hnsw",
                            hnsw_parameters=HnswParameters(metric="cosine")
                        )
                    ]
                )
            )
            print(f"Creating {AZURE_SEARCH_INDEX} search index")
            self.search_client.create_index(index)
        else:
            print(f"Search index {AZURE_SEARCH_INDEX} already exists")

    def create_sections(self, page_map, filename, category, filetag, folderid):
        file_id = self.filename_to_id(filename)
        for i, (content, pagenum) in enumerate(self.split_text(page_map, filename)):
            section = {
                "id": f"{file_id}-page-{i}",
                "content": content,
                "category": category,
                "sourcepage": self.blob_name_from_file_page(filename, pagenum),
                "sourcefile": filename,
                "filetag": filetag,
                "folderid": folderid

            }
            section["embedding"] = self.openai_service.compute_embedding(
                content)
            yield section

    def index_sections(self, filename, sections):
        print(
            f"Indexing sections from '{filename}' into search index '{AZURE_SEARCH_INDEX}'")

        i = 0
        batch = []
        for s in sections:
            batch.append(s)
            i += 1
            if i % 1000 == 0:
                results = self.search_index_client.upload_documents(
                    documents=batch)
                succeeded = sum([1 for r in results if r.succeeded])
                print(
                    f"\tIndexed {len(results)} sections, {succeeded} succeeded")
                batch = []

        if len(batch) > 0:
            results = self.search_index_client.upload_documents(
                documents=batch)
            succeeded = sum([1 for r in results if r.succeeded])
            print(
                f"\tIndexed {len(results)} sections, {succeeded} succeeded")

    def filename_to_id(self, filename):
        filename_ascii = re.sub("[^0-9a-zA-Z_-]", "_", filename)
        filename_hash = base64.b16encode(
            filename.encode('utf-8')).decode('ascii')
        return f"file-{filename_ascii}-{filename_hash}"

    def split_text(self, page_map, filename):
        SENTENCE_ENDINGS = [".", "!", "?"]
        WORDS_BREAKS = [",", ";", ":", " ",
                        "(", ")", "[", "]", "{", "}", "\t", "\n"]
        print(f"Splitting '{filename}' into sections")

        def find_page(offset):
            num_pages = len(page_map)
            for i in range(num_pages - 1):
                if offset >= page_map[i][1] and offset < page_map[i + 1][1]:
                    return i
            return num_pages - 1

        all_text = "".join(p[2] for p in page_map)
        length = len(all_text)
        start = 0
        end = length
        while start + SECTION_OVERLAP < length:
            last_word = -1
            end = start + MAX_SECTION_LENGTH

            if end > length:
                end = length
            else:
                # Try to find the end of the sentence
                while end < length and (end - start - MAX_SECTION_LENGTH) < SENTENCE_SEARCH_LIMIT and all_text[end] not in SENTENCE_ENDINGS:
                    if all_text[end] in WORDS_BREAKS:
                        last_word = end
                    end += 1
                if end < length and all_text[end] not in SENTENCE_ENDINGS and last_word > 0:
                    end = last_word  # Fall back to at least keeping a whole word
            if end < length:
                end += 1

            # Try to find the start of the sentence or at least a whole word boundary
            last_word = -1
            while start > 0 and start > end - MAX_SECTION_LENGTH - 2 * SENTENCE_SEARCH_LIMIT and all_text[start] not in SENTENCE_ENDINGS:
                if all_text[start] in WORDS_BREAKS:
                    last_word = start
                start -= 1
            if all_text[start] not in SENTENCE_ENDINGS and last_word > 0:
                start = last_word
            if start > 0:
                start += 1

            section_text = all_text[start:end]
            yield (section_text, find_page(start))

            last_table_start = section_text.rfind("<table")
            if (last_table_start > 2 * SENTENCE_SEARCH_LIMIT and last_table_start > section_text.rfind("</table")):
                # If the section ends with an unclosed table, we need to start the next section with the table.
                # If table starts inside SENTENCE_SEARCH_LIMIT, we ignore it, as that will cause an infinite loop for tables longer than MAX_SECTION_LENGTH
                # If last table starts inside SECTION_OVERLAP, keep overlapping

                print(
                    f"Section ends with unclosed table, starting next section with the table at page {find_page(start)} offset {start} table start {last_table_start}")
                start = min(end - SECTION_OVERLAP, start + last_table_start)
            else:
                start = end - SECTION_OVERLAP

        if start + SECTION_OVERLAP < end:
            yield (all_text[start:end], find_page(start))

    def blob_name_from_file_page(self, filename, page=0):
        if os.path.splitext(filename)[1].lower() == ".pdf":
            return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".pdf"
        else:
            return os.path.basename(filename)

    def remove_from_index(self, filename):
        print(
            f"Removing sections from '{filename}' from search index '{AZURE_SEARCH_INDEX}'")

        while True:
            filter = f"sourcefile eq '{filename}'"
            r = self.search_index_client.search(
                "", filter=filter, top=1000, include_total_count=True)
            if r.get_count() == 0:
                break
            r = self.search_index_client.delete_documents(
                documents=[{"id": d["id"]} for d in r])
            print(f"\tRemoved {len(r)} sections from index")
            # It can take a few seconds for search results to reflect changes, so wait a bit
            time.sleep(2)
