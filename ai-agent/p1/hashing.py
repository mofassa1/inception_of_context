# hashing.py
import hashlib

def hash_chunk(content: str) -> str:    
    return hashlib.sha256(content.rstrip().encode("utf-8")).hexdigest()

