import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

model = genai.GenerativeModel("gemini-2.5-flash")


def run():
    prompt = "You are an AI detective. Analyze this case."
    result = model.generate_content(prompt)
    print(result.text)


if __name__ == "__main__":
    run()
