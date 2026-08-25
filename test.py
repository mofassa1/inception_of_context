# Example 1: Standard usage
fruits_1 = {"apple", "banana", "cherry"}
fruits_2 = {"banana", "cherry", "date"}
print(fruits_1 & fruits_2)  
# Output: {'cherry', 'banana'}

# Example 2: Operator strictness error
# This raises: TypeError: unsupported operand type(s) for &: 'set' and 'list'
# print(fruits_1 & ["banana", "cherry"]) 

# Example 3: Method flexibility
print(fruits_1.intersection(["banana", "cherry"]))  
# Output: {'cherry', 'banana'}
