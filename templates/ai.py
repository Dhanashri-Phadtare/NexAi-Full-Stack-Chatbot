from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

SYSTEM_PROMPT = """
You are NexAI, an intelligent AI assistant.

Be professional, helpful, and concise.
If the user asks programming questions, explain with examples.
If you don't know something, say so rather than making it up.
"""

def ask_ai(user_message):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ],
        temperature=0.7,
        max_tokens=1024
    )

    return response.choices[0].message.content