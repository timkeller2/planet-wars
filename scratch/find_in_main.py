import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('server.js', 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f, 1):
        if 'port' in line.lower() or 'listen' in line.lower():
            print(f"{idx}: {line.strip()}")
