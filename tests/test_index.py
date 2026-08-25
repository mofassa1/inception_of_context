from p1.index import walk_target
import pytest


def test_walk_target():
    # Setup: Create a temporary directory structure for testing
    import tempfile
    import os

    with tempfile.TemporaryDirectory() as temp_dir:
        # Create some test files and directories
        os.makedirs(os.path.join(temp_dir, "subdir"))
        os.makedirs(os.path.join(temp_dir, "node_modules"))  # Should be excluded
        os.makedirs(os.path.join(temp_dir, ".git"))  # Should be excluded
        os.makedirs(os.path.join(temp_dir, "dist"))  # Should be excluded

        # Create test files
        file1 = os.path.join(temp_dir, "file1.txt")
        file2 = os.path.join(temp_dir, "subdir", "file2.txt")
        file3 = os.path.join(temp_dir, "node_modules", "file3.txt")  # Should be excluded
        file4 = os.path.join(temp_dir, ".git", "file4.txt")  # Should be excluded

        with open(file1, 'w') as f:
            f.write("This is a test file.")
        with open(file2, 'w') as f:
            f.write("This is another test file.")
        with open(file3, 'w') as f:
            f.write("This file should be excluded.")
        with open(file4, 'w') as f:
            f.write("This file should also be excluded.")

        # Call the function under test
        result_files = list(walk_target(temp_dir, temp_dir))

        # Assertions: Check that only the expected files are returned
        assert file1 in result_files
        assert file2 in result_files
        assert file3 not in result_files  # Excluded directory
        assert file4 not in result_files  # Excluded directory

