import os

from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_ID = "gemini-2.5-flash"

CLOVA_INVOKE_URL = os.getenv(
    "CLOVA_INVOKE_URL",
    "https://clovaspeech-gw.ncloud.com/external/v1/15024/c4de3225b3ec50c9169584d70190755dfdfb078ecb26515de6fd0a2f12288d75"
)
CLOVA_SECRET_KEY = os.getenv("CLOVA_SECRET_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)
