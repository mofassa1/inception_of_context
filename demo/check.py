"""The validation command of ioc.config.yml: check the files that changed, then run every test.

    python check.py <changed files...>
"""

import py_compile
import shutil
import subprocess
import sys
import unittest


def check_file(path):
    if path.endswith(".py"):
        py_compile.compile(path, doraise=True)
    elif path.endswith(".js") and shutil.which("node"):
        subprocess.run(["node", "--check", path], check=True)


def main(paths):
    for path in paths:
        try:
            check_file(path)
        except py_compile.PyCompileError as error:
            print(error.msg)
            return 1
        except subprocess.CalledProcessError:
            print(f"{path} is not valid JavaScript")
            return 1

    suite = unittest.defaultTestLoader.discover("tests")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
