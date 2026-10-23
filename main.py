from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-20b")

while True:
    question = input("Enter the question: ").strip()
    if question.lower() in {"exit", "quit"}:
        break
    if not question:
        continue

    response = llm.invoke(question)
    print(response.content)