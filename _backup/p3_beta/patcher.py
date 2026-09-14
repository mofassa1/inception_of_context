from p2.llm_object import llm_manager
from p2.embidder_object import embedder
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from p2.llm_manager import CodePatch, PatchFile
from p2.store import vector_store as store
import ast
import os
import shutil
from pathlib import Path
import os
import subprocess
import yaml

prompt_template = """
You are a coding agent responsible for proposing changes to an existing codebase.

Your task is to modify the codebase according to the user's request.

USER REQUEST:
{query}

AVAILABLE FILES:
{file_paths}

RELEVANT CODE CONTEXT:
{context}

PREVIOUS ATTEMPT / ITERATION FEEDBACK:
{attempt_message}

RULES:

1. Only modify files whose paths appear in AVAILABLE FILES.

2. For each file, choose exactly one operation:
   - "create": create a new file. Use this only if the file does not already exist.
   - "modify": modify an existing file.
   - "delete": delete an existing file.

3. For "modify", provide the COMPLETE resulting content of the file.
   Do NOT provide a diff, patch, or only the changed lines.

4. For "create", provide the COMPLETE content of the new file.

5. For "delete", no file content is required.

6. Do not modify files that are unrelated to the user's request.

7. Do not invent file paths. Use paths exactly as they appear in AVAILABLE FILES.

8. Preserve the existing code's structure and behavior unless the user's
   request requires changing it.

9. Make the smallest reasonable change that satisfies the user's request.

10. If the request cannot be safely implemented from the provided context,
    do not invent missing code, files, APIs, or behavior.

11. Determine whether the user's request actually requires modifying the
    codebase.

12. If the user's request is a question, explanation, review, feedback,
    or any other request that does NOT require a code change:
    - Do not create, modify, or delete any files.
    - Use "noop" as the operation.
    - Set "content" to an empty string.
    - Put the answer, explanation, or feedback in the "summary" field.
    - The summary should directly answer the user's request.

13. If the request requires code changes:
    - Use "create", "modify", or "delete" as appropriate.
    - Do not use "noop".
    - The summary should briefly describe the proposed changes.

14. For a "noop" operation, the file path is not relevant and should not
    refer to a file that is being modified.

15. PREVIOUS ATTEMPT FEEDBACK:
    - Treat the previous attempt as feedback, not as authoritative code.
    - Carefully inspect any reported errors or failed tests.
    - If the previous attempt failed, identify the likely cause and correct it.
    - Do not repeat an approach that the testing results demonstrate is wrong.
    - Preserve parts of the previous solution that were shown to work when
      they are still relevant.
    - If the previous attempt contains code, do not assume that code is
      correct. Compare it against the AVAILABLE FILES and RELEVANT CODE CONTEXT.
    - If no previous attempt or testing results are provided, solve the request
      normally.

16. TESTING RESULTS:
    - Give higher priority to concrete test failures and runtime errors than
      to assumptions made in the previous attempt.
    - Use error messages and stack traces to determine what needs to change.
    - Do not claim that something works if the provided testing results show
      otherwise.
    - Fix the underlying cause rather than merely hiding or bypassing the error.

IMPORTANT:

- The response will be parsed as a structured CodePatch object.
- Return only the structured response expected by CodePatch.
- Do not return explanations, markdown, diffs, or code fences outside the
  structured response.
- The summary should briefly describe the proposed changes.
- Each file entry must contain its path, operation, and resulting content when
  applicable.
- Every "modify" operation must contain the COMPLETE resulting file content.
"""

attempt_message_template = """
PREVIOUS ATTEMPT / ITERATION FEEDBACK:

This is feedback from a previous attempt at solving the same user request.
Use it to improve the current solution. Do not blindly repeat the previous
approach if the testing results or errors show that it was incorrect.

USER REQUEST FROM THE PREVIOUS ATTEMPT:
{query}

PREVIOUS RESPONSE:
{response}

TESTING / VALIDATION RESULTS:
{testing_results}

ERRORS OR FAILURES:
{errors}

WHAT WORKED:
{what_worked}

WHAT DID NOT WORK:
{what_did_not_work}

ADDITIONAL OBSERVATIONS:
{observations}
"""

class Patcher:
    def __init__(self, project_root: str):
        self.backuped_files = []
        self.new_files = []
        self.deleted_files = []
        self.modified_files = []
        self.project_root = project_root
    def build_prompt_template(self, query: str, file_paths: list[str], context: str, attempt_message: str) -> str:
        """Build the prompt template for the code model."""
        return prompt_template.format(
            query=query,
            file_paths="\n".join(file_paths),
            context=context
        ) + attempt_message_template.format(attempt_message=attempt_message) if attempt_message else ""

    def generate_code_response(self, messages: list[BaseMessage]) -> CodePatch:
        """Generate a code response using the code model."""
        return llm_manager.generate_code_response(messages)
        
    def answer_user_query(self, message: str, attempt_message: str) -> CodePatch:
        message_embedding = embedder.create_embeddings([message])
        top_k_chunks = store.cosine_similarity_search(query_embedding=message_embedding[0], n_results=5)
        prompt = self.build_prompt_template(query=message, file_paths=store.get_all_files(), context="\n\n".join(top_k_chunks), attempt_message=attempt_message)
        return self.generate_code_response([HumanMessage(content=prompt)])

    def is_file_existing(self, file_path: str) -> bool:
        """Check if a file exists in the vector store."""
        existing_files = store.get_all_files()
        return file_path in existing_files



    def contains_obvious_stub(self, content: str) -> bool:
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

    def sanity_checker(self, response: CodePatch) -> int:
        """Check if the response is valid according to the rules."""
        if len(response.files) == 1 and response.files[0].op == "noop" and response.files[0].content == "":
            return 1
        if len(response.files) == 0:
            return 2
        if len(response.files) > 3:
            return 3
        
        existing_file_size = dict[str, int]()
        
        for file in response.files:
            if file.op not in ["create", "modify", "delete", "noop"]:
                return 4
            if file.op == "create" and self.is_file_existing(file.path):
                return 5
            if (file.op == "delete" or file.op == "modify") and not self.is_file_existing(file.path):
                return 6
            if (file.op == "modify" or file.op == "create") and (not file.content or not isinstance(file.content, str)):
                return 7
            if (file.op == "create" or file.op == "modify") and self.contains_obvious_stub(file.content):
                return 8
            if file.op == "modify":
                existing_file_content = store.get_chunks_by_file(file.path)
                existing_file_size[file.path] = sum(len(chunk["document"]) for chunk in existing_file_content.get("documents", []))
                if  (existing_file_size[file.path] - len(file.content)) / existing_file_size[file.path] > 0.6:
                    return 9
            

        return 0


    def create_backup(self, response: CodePatch, backup_dir: str) -> str:
        os.makedirs(backup_dir, exist_ok=True)

        for file in response.files:
            if file.op not in ("modify", "delete"):
                continue

            if not os.path.isfile(file.path):
                continue

            backup_path = os.path.join(backup_dir, file.path.lstrip(os.sep))

            os.makedirs(os.path.dirname(backup_path), exist_ok=True)

            shutil.copy2(file.path, backup_path)
            self.backuped_files.append(backup_path)

        return backup_dir


    def atomic_replacement(self, response: CodePatch) -> None:

        staged: list[tuple[str, str]] = [] 
        to_delete: list[str] = []

        try:
        
            for file in response.files:
                if file.op in ("create", "modify"):
                    parent_dir = os.path.dirname(file.path)
                    if parent_dir:
                        os.makedirs(parent_dir, exist_ok=True)

                    tmp_path = file.path + ".ioc.tmp"
                    with open(tmp_path, "w", encoding="utf-8") as f:
                        f.write(file.content)

                    staged.append((tmp_path, file.path))

                elif file.op == "delete":
                    to_delete.append(file.path)

                elif file.op == "noop":
                    continue
            for tmp_path, final_path in staged:
                os.replace(tmp_path, final_path)

            for path in to_delete:
                if os.path.isfile(path):
                    os.remove(path)

        except Exception:
            for tmp_path, _ in staged:
                if os.path.isfile(tmp_path):
                    os.remove(tmp_path)
            raise


    def restore_backup(self) -> None:
        while self.backuped_files:
            source_path = self.backuped_files.pop()
            sorce_cleand_path = Path(source_path)
            dest_path = Path("/") / Path(*sorce_cleand_path.parts[2:])

            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            shutil.copy2(source_path, dest_path)



    def create_new_files(self, response: CodePatch) -> None:
        """Create all files marked with the 'create' operation."""
        for file in response.files:
            if file.op != "create":
                continue

            if not os.path.isabs(file.path):
                raise ValueError(f"File path must be absolute: {file.path}")

            if os.path.exists(file.path):
                raise FileExistsError(f"File already exists: {file.path}")

            parent_dir = os.path.dirname(file.path)

            if parent_dir:
                os.makedirs(parent_dir, exist_ok=True)

            with open(file.path, "w", encoding="utf-8") as f:
                f.write(file.content)
    
    def delete_files(self, response: CodePatch) -> None:
        """Delete all files marked with the 'delete' operation."""
        for file in response.files:
            if file.op != "delete":
                continue

            if not os.path.isabs(file.path):
                raise ValueError(f"File path must be absolute: {file.path}")

            if not os.path.exists(file.path):
                raise FileNotFoundError(f"File does not exist: {file.path}")

            os.remove(file.path)




    def launch_tests(self) -> tuple[bool, str]:
        """
        Run the validation command defined in ioc.config.yml.

        The configuration file must be located at the target project's root
        and contain:

            validation:
            command: "pytest"

        The command is executed with project_root as the working directory.

        Returns:
            (True, output)  -> validation succeeded
            (False, output) -> validation failed
        """

        config_path = os.path.join(self.project_root, "ioc.config.yml")

        if not os.path.isfile(config_path):
            return False, "ioc.config.yml not found"

        with open(config_path, "r") as f:
            config = yaml.safe_load(f)

        command = config.get("validation", {}).get("command")

        if not command:
            return False, "No validation command configured"

        result = subprocess.run(
            command,
            shell=True,
            cwd=self.project_root,
            capture_output=True,
            text=True,
        )

        output = result.stdout + result.stderr

        if result.returncode == 0:
            return True, output

        return False, output


    