import os
import logging
import uuid
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Tuple

from langchain.vectorstores.redis import Redis
from langchain.docstore.document import Document
from langchain.embeddings.base import Embeddings
from langchain.vectorstores.base import VectorStore
from langchain.embeddings.openai import OpenAIEmbeddings

import pandas as pd
from redis.commands.search.query import Query
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.field import VectorField, TagField, TextField

logger = logging.getLogger()
REDIS_URL = os.getenv("REDIS_URL")
REDIS_KEY = os.getenv("REDIS_KEY")
REDIS_INDEX_NAME = os.getenv("REDIS_INDEX_NAME")
AZURE_REDIS_URL = "rediss://:" + REDIS_KEY + "@" + REDIS_URL
AZURE_OPENAI_EMB_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")


class RedisService(Redis):
    def __init__(self):
        super().__init__(AZURE_REDIS_URL, REDIS_INDEX_NAME, OpenAIEmbeddings(model=AZURE_OPENAI_EMB_DEPLOYMENT,
                                                                             deployment=AZURE_OPENAI_EMB_DEPLOYMENT, chunk_size=1).embed_query)

        try:
            self.client.ft(self.index_name).info()
        except:
            # Create Redis Index
            self.create_index()

    def check_existing_index(self, index_name: str = None):
        try:
            self.client.ft(
                index_name if index_name else self.index_name).info()
            return True
        except:
            return False

    def delete_keys(self, keys: List[str]) -> None:
        for key in keys:
            self.client.delete(key)

    def delete_keys_pattern(self, pattern: str) -> None:
        keys = self.client.keys(pattern)
        self.delete_keys(keys)

    def delete_by_chatid(self, chatid: str):
        page_size = 50  # 一度に取得するドキュメント数

        while True:
            query = Query(
                f'@chat_id:"{chatid.replace("-", "")}"').paging(0, page_size)
            result = self.client.ft(REDIS_INDEX_NAME).search(query=query)

            # ドキュメントがなければループを抜ける
            if not result.docs:
                break

            if result.total > page_size:
                page_size = result.total
                continue

            for item in result.docs:
                self.client.delete(item['id'])
                print(item['id'] + " is deleted in redis.")


    def create_index(self, prefix="doc", distance_metric: str = "COSINE"):
        content = TextField(name="content")
        chat_id = TextField(name="chat_id")
        source = TextField(name="source")
        resource = TextField(name="resource")
        content_vector = VectorField("content_vector",
                                     "HNSW", {
                                         "TYPE": "FLOAT32",
                                         "DIM": 1536,
                                         "DISTANCE_METRIC": distance_metric,
                                         "INITIAL_CAP": 2000,
                                     })
        # Create index
        self.client.ft(self.index_name).create_index(
            fields=[content, chat_id, source, resource, content_vector],
            definition=IndexDefinition(
                prefix=[prefix], index_type=IndexType.HASH)
        )
