import os
try:
    with open('/Users/haroonayaz/Desktop/projects/NexTex/backend/test.txt', 'w') as f:
        f.write('hello')
    print("Success")
except Exception as e:
    print(f"Error: {e}")
