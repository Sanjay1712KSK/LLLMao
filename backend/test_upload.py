import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
import io

async def test():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        files = {"file": ("test.webm", b"dummy audio data", "audio/webm")}
        data = {"chat_id": "1"}
        response = await ac.post("/audio/upload", files=files, data=data)
        print("Status:", response.status_code)
        print("JSON:", response.json())

if __name__ == "__main__":
    asyncio.run(test())
