"""Stage 4 - Query Type Classifier"""
import re
from dataclasses import dataclass

class QueryType:
    FACTUAL="factual"; SUMMARIZATION="summarization"
    REASONING="reasoning"; MULTI_HOP="multi_hop"

@dataclass
class RetrievalConfig:
    query_type:str; top_k:int; rerank:bool; iterative:bool
    context_budget:int; confidence_threshold:float
    def __str__(self): return f"Config(type={self.query_type},k={self.top_k})"

_C={
    "factual":        RetrievalConfig("factual",3,False,False,512,0.5),
    "summarization":  RetrievalConfig("summarization",10,True,False,2048,0.4),
    "reasoning":      RetrievalConfig("reasoning",7,True,False,4096,0.45),
    "multi_hop":      RetrievalConfig("multi_hop",5,True,True,2048,0.5),
}

class QueryClassifier:
    """Stage 4 - Query Type Classifier"""
import re
from dataclasses import dataclass

class QueryType:
    FACTUAL="factual"; SUMMARIZATION="summarization"
    REASONING="reasoning"; MULTI_HOP="multi_hop"

@dataclass
class RetrievalConfig:
    query_type:str; top_k:int; rerank:bool; iterative:bool
    context_budget:int; confidence_threshold:float
    def __str__(self): return f"Config(type={self.query_type},k={self.top_k})"

_C={
    "factual":        RetrievalConfig("factual",3,False,False,512,0.5),
    "summarization":  RetrievalConfig("summarization",10,True,False,2048,0.4),
    "reasoning":      RetrievalConfig("reasoning",7,True,False,4096,0.45),
    "multi_hop":      RetrievalConfig("multi_hop",5,True,True,2048,0.5),
}

class QueryClassifier:
    _P = {
        "factual": [
            r"\bwhat is\b",
            r"\bwho is\b",
            r"\bwhen (was|did|is)\b",
            r"\bwhere (is|was)\b",
            r"\bdefine\b",
            r"\bhow (many|much|old|long)\b",
        ],

        "summarization": [
            r"\bsummar[ize]+\b",
            r"\boverview\b",
            r"\bbriefly\b",
            r"\bmain (idea|point|finding|contribution)s?\b",
            r"\bkey (idea|point|finding|contribution|contributions)\b",
            r"\bmain contribution\b",
            r"\bkey contribution\b",
            r"\bmajor contribution\b",
            r"\bkey findings?\b",
            r"\bmain findings?\b",
            r"\bmain novelty\b",
            r"\bkey novelty\b",
            r"\bwhat is novel\b",
            r"\bwhat are the contributions\b",
            r"\bwhat is the contribution\b",
            r"\btldr\b",
            r"\boutline\b",
        ],

        "reasoning": [
            r"\bwhy\b",
            r"\bhow does\b",
            r"\bexplain\b",
            r"\banalyze\b",
            r"\banalyse\b",
            r"\bcompare\b",
            r"\bevaluate\b",
            r"\bdiscuss\b",
        ],

        "multi_hop": [
            r"\bboth\b",
            r"\bthroughout\b",
            r"\bacross\b",
            r"\brelationship between\b",
            r"\bhow .+ relate\b",
            r"\bconnection between\b",
        ],
    }
    def __init__(self):
        self._cp={qt:[re.compile(p,re.I) for p in ps] for qt,ps in self._P.items()}
    def classify(self,query):
        sc={qt:sum(1 for p in ps if p.search(query)) for qt,ps in self._cp.items()}
        priority=["multi_hop","reasoning","summarization","factual"]
        best=max(priority,key=lambda qt:sc[qt])
        qt=best if sc[best]>0 else "reasoning"
        cfg=_C[qt]; print(f"[Router] '{query[:50]}' -> {qt} (k={cfg.top_k})")
        return cfg
    def get_config(self,qt): return _C.get(qt,_C["factual"])

    def __init__(self):
        self._cp={qt:[re.compile(p,re.I) for p in ps] for qt,ps in self._P.items()}
    def classify(self,query):
        sc={qt:sum(1 for p in ps if p.search(query)) for qt,ps in self._cp.items()}
        priority=["multi_hop","reasoning","summarization","factual"]
        best=max(priority,key=lambda qt:sc[qt])
        qt=best if sc[best]>0 else "reasoning"
        cfg=_C[qt]; print(f"[Router] '{query[:50]}' -> {qt} (k={cfg.top_k})")
        return cfg
    def get_config(self,qt): return _C.get(qt,_C["factual"])
