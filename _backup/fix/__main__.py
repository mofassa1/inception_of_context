import argparse
import sys

from fix.index import index_folder


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m fix")
    commands = parser.add_subparsers(dest="command", required=True)

    index = commands.add_parser("index", help="index a folder, then watch it (Ctrl-C to stop)")
    index.add_argument("folder")
    index.add_argument("--once", action="store_true", help="index and exit, without watching")

    arguments = parser.parse_args(argv)
    index_folder(arguments.folder, watch=not arguments.once)
    return 0


if __name__ == "__main__":
    sys.exit(main())
