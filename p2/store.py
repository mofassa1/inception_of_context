from typing import Optional
from p1.db import VectorStore
from p1.general_infos_object import g_infos
from p1.utils import collection_name_from_path

collection_name = collection_name_from_path(g_infos.get_target_path())

vector_store = VectorStore(
    "./chroma_db",
    collection_name=collection_name
)