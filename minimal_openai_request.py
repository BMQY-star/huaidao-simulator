import json
import os
import requests

API_URL = os.getenv("LLM_API_URL", "http://111.119.221.189:9600/openai/v1/responses")
API_KEY = os.getenv("LLM_API_KEY")
if not API_KEY:
    raise SystemExit("Missing LLM_API_KEY env var (set it in your environment).")


payload = {
    "model": "gpt-5.1-codex-max",
    "stream": True,
    "input": [
        {
            "role": "system",
            "content": [{"type": "input_text", "text": "You are a helpful assistant."}],
        },
        {
            "role": "user",
            "content": [{"type": "input_text", "text": "hi"}],
        },
    ],
}

def collect_stream(resp):
    chunks = []
    for raw_line in resp.iter_lines():
        if not raw_line:
            continue
        line = raw_line.decode("utf-8").strip()
        if not line or line == "[DONE]" or not line.startswith(("data:", "{")):
            continue
        if line.startswith("data:"):
            line = line[5:].strip()
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "response.output_text.delta":
            chunks.append(event.get("delta", ""))
    return "".join(chunks)

with requests.post(
    API_URL,
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
    json=payload,
    stream=True,
) as resp:
    resp.raise_for_status()
    print(collect_stream(resp))
