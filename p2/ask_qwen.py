import argparse
import sys
import ollama
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage

MODEL_NAME = "qwen2.5:3b"

def ensure_model_exists(model_name: str) -> None:
    """Check if the Ollama model exists locally; if not, pull it."""
    try:
        # Retrieve the list of models currently downloaded locally
        response = ollama.list()
        
        # Extract model names from response objects/dictionaries
        local_models = []
        for m in response.get("models", []):
            if isinstance(m, dict):
                local_models.append(m.get("model") or m.get("name"))
            else:
                local_models.append(getattr(m, "model", getattr(m, "name", "")))
        
        # Append ':latest' tag if no specific tag was provided for clean comparison
        check_name = model_name if ":" in model_name else f"{model_name}:latest"
        
        if not any(check_name in m for m in local_models if m):
            print(f"Model '{model_name}' not found locally. Pulling model...", file=sys.stderr)
            ollama.pull(model_name)
            print(f"Model '{model_name}' successfully downloaded!\n", file=sys.stderr)
            
    except Exception as e:
        print(f"Error connecting to local Ollama server: {e}", file=sys.stderr)
        print("Please make sure the Ollama application or service is running.", file=sys.stderr)
        sys.exit(1)

def main() :
    # Set up command line argument parsing
    parser = argparse.ArgumentParser(
        description="Query the local qwen2.5:3b model using LangChain and Ollama."
    )
    parser.add_argument(
        "prompt", 
        type=str, 
        help="The prompt/question to pass to the model."
    )
    args = parser.parse_args()

    # 1. Verify model presence or pull it
    ensure_model_exists(MODEL_NAME)

    # 2. Instantiate the local model via LangChain
    llm = ChatOllama(model=MODEL_NAME)

    # 3. Query the model and stream/print to stdout
    print(f"--- Response from {MODEL_NAME} ---", file=sys.stderr)
    
    # Using streaming to write to stdout directly as it responds
    for chunk in llm.stream([HumanMessage(content=args.prompt)]):
        print(chunk.content, end="", flush=True)  # Print each chunk without newline and flush immediately
        # sys.stdout.write(chunk.content)
        # sys.stdout.flush()
    
    print()  # Add a trailing newline

if __name__ == "__main__":
    main()