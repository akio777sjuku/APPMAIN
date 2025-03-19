import os
import html
from pypdf import PdfReader
from azure.core.credentials import AzureKeyCredential
from azure.ai.formrecognizer import DocumentAnalysisClient

AZURE_FORMRECOGNIZER_SERVICE = os.getenv("AZURE_FORMRECOGNIZER_SERVICE")
AZURE_FORMRECOGNIZER_KEY = os.getenv("AZURE_FORMRECOGNIZER_KEY")


class FormRecognizerService():

    def __init__(self):
        self.form_recognizer_client = DocumentAnalysisClient(
            endpoint=f"https://{AZURE_FORMRECOGNIZER_SERVICE}.cognitiveservices.azure.com/",
            credential=AzureKeyCredential(AZURE_FORMRECOGNIZER_KEY), headers={"x-ms-useragent": "azure-search-chat-demo/1.0.0"})

    def get_document_text(self, filename, localpdfparser=False):
        offset = 0
        page_map = []
        if localpdfparser:
            reader = PdfReader(filename)
            pages = reader.pages
            for page_num, p in enumerate(pages):
                page_text = p.extract_text()
                page_map.append((page_num, offset, page_text))
                offset += len(page_text)
        else:
            print(
                f"Extracting text from '{filename}' using Azure Form Recognizer")

            with open(filename, "rb") as f:
                poller = self.form_recognizer_client.begin_analyze_document(
                    "prebuilt-layout", document=f)
            form_recognizer_results = poller.result()

            for page_num, page in enumerate(form_recognizer_results.pages):
                tables_on_page = [
                    table for table in form_recognizer_results.tables if table.bounding_regions[0].page_number == page_num + 1]

                # mark all positions of the table spans in the page
                page_offset = page.spans[0].offset
                page_length = page.spans[0].length
                table_chars = [-1]*page_length
                for table_id, table in enumerate(tables_on_page):
                    for span in table.spans:
                        # replace all table spans with "table_id" in table_chars array
                        for i in range(span.length):
                            idx = span.offset - page_offset + i
                            if idx >= 0 and idx < page_length:
                                table_chars[idx] = table_id

                # build page text by replacing characters in table spans with table html
                page_text = ""
                added_tables = set()
                for idx, table_id in enumerate(table_chars):
                    if table_id == -1:
                        page_text += form_recognizer_results.content[page_offset + idx]
                    elif table_id not in added_tables:
                        page_text += self.table_to_html(
                            tables_on_page[table_id])
                        added_tables.add(table_id)

                page_text += " "
                page_map.append((page_num, offset, page_text))
                offset += len(page_text)

        return page_map

    def table_to_html(self, table):
        table_html = "<table>"
        rows = [sorted([cell for cell in table.cells if cell.row_index == i],
                       key=lambda cell: cell.column_index) for i in range(table.row_count)]
        for row_cells in rows:
            table_html += "<tr>"
            for cell in row_cells:
                tag = "th" if (
                    cell.kind == "columnHeader" or cell.kind == "rowHeader") else "td"
                cell_spans = ""
                if cell.column_span > 1:
                    cell_spans += f" colSpan={cell.column_span}"
                if cell.row_span > 1:
                    cell_spans += f" rowSpan={cell.row_span}"
                table_html += f"<{tag}{cell_spans}>{html.escape(cell.content)}</{tag}>"
            table_html += "</tr>"
        table_html += "</table>"
        return table_html
