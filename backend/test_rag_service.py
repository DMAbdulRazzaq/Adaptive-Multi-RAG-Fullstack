import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.rag_service import rag_service


result = rag_service.query(
    question="What is the main contribution of this research?",
    document_path=str(
        PROJECT_ROOT / "data" / "demo_document.txt"
    ),
    backend="ollama",
    model="llama3.2",
)


print("\n" + "=" * 70)
print("RAG SERVICE TEST")
print("=" * 70)

print("\nANSWER:")
print(result["answer"])

print("\nQUERY TYPE:")
print(result["query_type"])

print("\nMODEL:")
print(result["model_used"])

print("\nCHUNKS USED:")
print(result["chunks_used"])

print("\nCONFIDENCE:")
print(result["confidence"])

print("\nLATENCY:")
print(result["latency_ms"], "ms")

print("\nSOURCES:")

for source in result["sources"]:
    print(
        f"- {source['section_title']} "
        f"| chunk={source['chunk_id']}"
    )

print("=" * 70)