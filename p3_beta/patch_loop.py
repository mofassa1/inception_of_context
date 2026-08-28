from apply_safely import CodePatch
from patcher import Patcher

mok_project_root = "/home/afadouac/Desktop/inception_of_context"

patcher_instance = Patcher(project_root=mok_project_root)

feedback = ""

SANITY_CHECK_DESCRIPTIONS = {
    0: "The response passed all sanity checks.",
    
    1: (
        "The response is a noop. No code changes are required."
    ),
    
    2: (
        "The response does not contain any files. "
        "If the request requires code changes, provide at least one file operation."
    ),
    
    3: (
        "The response contains more than 3 files. "
        "Reduce the changes to only the files necessary to satisfy the request."
    ),
    
    4: (
        "The response contains an invalid file operation. "
        "Each file operation must be one of: create, modify, delete, or noop."
    ),
    
    5: (
        "The response attempts to create a file that already exists. "
        "Use 'modify' instead if the existing file needs to be changed."
    ),
    
    6: (
        "The response attempts to modify or delete a file that does not exist. "
        "Only modify or delete existing files."
    ),
    
    7: (
        "A create or modify operation has missing or invalid content. "
        "The content must be a non-empty string containing the complete file content."
    ),
    
    8: (
        "A create or modify operation contains an obvious stub or incomplete implementation. "
        "Provide a complete implementation instead of placeholders, TODOs, or similar stubs."
    ),
    
    9: (
        "A modify operation removes more than 60% of the existing file content. "
        "Preserve the existing implementation and make the smallest change necessary "
        "to satisfy the request."
    ),
}

def loop(query: str):
    """Continuously prompt the user for a query and answer it using the code model."""
    for iteration in range(3): 
        response = patcher_instance.answer_user_query(query, attempt_message=feedback)
        sanity_result = patcher_instance.sanity_checker(response)
        
        if  sanity_result != 0:
            feedback = SANITY_CHECK_DESCRIPTIONS[sanity_result]
            continue
        else:
            try:
                patcher_instance.create_backup(response, backup_dir="backups")
                patcher_instance.atomic_replacement(response)
                patcher_instance.create_new_files(response)
                patcher_instance.delete_files(response)
                state, feedback = patcher_instance.launch_tests()
                if state:
                    return response
                else:
                    feedback = f"Tests failed: {feedback}"
                    continue
            except Exception as e:
                feedback = f"Error applying changes: {e}."
                continue
                
            

