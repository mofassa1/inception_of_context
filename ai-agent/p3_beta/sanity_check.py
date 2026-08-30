from p2.llm_manager import CodePatch, PatchFile
from p2.store import vector_store as store
import ast

def is_file_existing(file_path: str) -> bool:
    """Check if a file exists in the vector store."""
    existing_files = store.get_all_files()
    return file_path in existing_files



def contains_obvious_stub(content: str) -> bool:
    stub_patterns = [
        "...",
        "TODO",
        "return None",
    ]

    tree = ast.parse(content)

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if not node.body:
                return True
            if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                return True
            if len(node.body) == 1 and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Constant) and node.body[0].value.value in stub_patterns:
                return True
    for pattern in stub_patterns:
        if pattern in content:
            return True
    return False

def sanity_checker(response: CodePatch) -> bool:
    """Check if the response is valid according to the rules."""
    if len(response.files) == 1 and response.files[0].op == "noop" and response.files[0].content == "":
        return True
    if len(response.files) == 0:
        return False
    if len(response.files) > 3:
        return False
    
    existing_file_size = dict[str, int]()
    
    for file in response.files:
        if file.op not in ["create", "modify", "delete", "noop"]:
            return False
        if file.op == "create" and is_file_existing(file.path):
            return False
        if (file.op == "delete" or file.op == "modify") and not is_file_existing(file.path):
            return False
        if (file.op == "modify" or file.op == "create") and (not file.content or not isinstance(file.content, str)):
            return False
        if (file.op == "create" or file.op == "modify") and contains_obvious_stub(file.content):
            return False
        if file.op == "modify":
            existing_file_content = store.get_chunks_by_file(file.path)
            existing_file_size[file.path] = sum(len(chunk["document"]) for chunk in existing_file_content.get("documents", []))
            if  (existing_file_size[file.path] - len(file.content)) / existing_file_size[file.path] > 0.6:
                return False
        

    return True