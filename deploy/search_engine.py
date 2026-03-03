"""
TF-IDF search engine — exact port of server/search-engine.js
"""
import re
import math
from typing import Any


class TfIdfSearchEngine:
    def __init__(self):
        self.documents: list[dict] = []
        self.idf_cache: dict[str, float] = {}
        self.tfidf_cache: list[dict[str, float]] = []
        self.df_map: dict[str, int] = {}
        self.doc_count: int = 0

    # ── tokenize ──
    def tokenize(self, text: str | None) -> list[str]:
        if not text:
            return []
        s = text.lower()
        # 영문-한글 경계
        s = re.sub(r"([a-z])([가-힣])", r"\1 \2", s)
        s = re.sub(r"([가-힣])([a-z])", r"\1 \2", s)
        # 영문-숫자 경계
        s = re.sub(r"([a-z])([0-9])", r"\1 \2", s)
        s = re.sub(r"([0-9])([a-z])", r"\1 \2", s)
        # 한글-숫자 경계
        s = re.sub(r"([가-힣])([0-9])", r"\1 \2", s)
        s = re.sub(r"([0-9])([가-힣])", r"\1 \2", s)
        # 특수문자 제거
        s = re.sub(r"[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]", " ", s)
        tokens = s.split()
        return [t for t in tokens if len(t) > 0]

    # ── build index ──
    def build_index(self, documents: list[dict]):
        self.documents = documents
        self.idf_cache = {}
        self.tfidf_cache = []

        N = len(documents)
        all_token_sets = []
        for doc in documents:
            text = self._doc_to_text(doc)
            all_token_sets.append(set(self.tokenize(text)))

        # Compute DF
        self.df_map = {}
        for token_set in all_token_sets:
            for token in token_set:
                self.df_map[token] = self.df_map.get(token, 0) + 1

        # Compute IDF
        for token, df in self.df_map.items():
            self.idf_cache[token] = math.log(N / (1 + df)) + 1
        self.doc_count = N

        # Compute TF-IDF vectors
        self.tfidf_cache = []
        for doc in documents:
            text = self._doc_to_text(doc)
            tokens = self.tokenize(text)
            tf: dict[str, int] = {}
            for t in tokens:
                tf[t] = tf.get(t, 0) + 1
            max_tf = max(tf.values()) if tf else 1
            vec: dict[str, float] = {}
            for t, count in tf.items():
                vec[t] = (count / max_tf) * self.idf_cache.get(t, 0)
            self.tfidf_cache.append(vec)

    # ── search ──
    def search(self, query: str, top_k: int = 10) -> list[dict]:
        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        query_tf: dict[str, int] = {}
        for t in query_tokens:
            query_tf[t] = query_tf.get(t, 0) + 1
        max_tf = max(query_tf.values()) if query_tf else 1
        query_vec: dict[str, float] = {}
        for t, count in query_tf.items():
            query_vec[t] = (count / max_tf) * self.idf_cache.get(t, 1)

        results = []
        for idx, doc_vec in enumerate(self.tfidf_cache):
            score = self._cosine_similarity(query_vec, doc_vec)
            if score > 0:
                results.append({
                    "index": idx,
                    "score": score,
                    "document": self.documents[idx],
                })

        results.sort(key=lambda r: r["score"], reverse=True)
        return results[:top_k]

    # ── doc → text ──
    def _doc_to_text(self, doc: dict) -> str:
        splits = doc.get("_splits", [])
        split_parts: list[str] = []
        for s in splits:
            for key in ("fac_id", "oper_id", "oper_nm", "eps_lot_gbn_cd",
                         "work_cond_desc", "eqp_id", "recipe_id", "note"):
                val = s.get(key)
                if val:
                    split_parts.append(val)

        parts = [
            # 실험 필드
            doc.get("iacpj_nm"),
            doc.get("module"),
            doc.get("eval_item"),
            doc.get("eval_process"),
            doc.get("eval_category"),
            doc.get("requester"),
            doc.get("lot_code"),
            doc.get("plan_id"),
            doc.get("team"),
            doc.get("wf_direction"),
            doc.get("prev_eval"),
            doc.get("cross_experiment"),
            doc.get("lot_request"),
            doc.get("reference"),
            doc.get("volume_split"),
            doc.get("assign_wf"),
            doc.get("refdata"),
            doc.get("request_date"),
            # 과제 필드 (가중치 부여 — 반복)
            doc.get("project_purpose"),
            doc.get("project_purpose"),
            doc.get("iacpj_ta_goa"),
            doc.get("iacpj_ta_goa"),
            doc.get("iacpj_ta_goa"),
            doc.get("iacpj_cur_stt"),
            doc.get("iacpj_cur_stt"),
            doc.get("iacpj_tech_n"),
            doc.get("project_module"),
            doc.get("iacpj_tgt_n"),
            doc.get("iacpj_ch_n"),
            doc.get("ia_ta_grd_n"),
            doc.get("iacpj_level"),
            doc.get("iacpj_nud_n"),
            doc.get("iacpj_core_tec"),
            doc.get("ia_ch_or_n"),
            # 스플릿 필드
            *split_parts,
        ]
        return " ".join(p for p in parts if p)

    # ── cosine similarity ──
    @staticmethod
    def _cosine_similarity(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
        dot = 0.0
        mag_a = 0.0
        mag_b = 0.0
        all_keys = set(vec_a.keys()) | set(vec_b.keys())
        for key in all_keys:
            a = vec_a.get(key, 0)
            b = vec_b.get(key, 0)
            dot += a * b
            mag_a += a * a
            mag_b += b * b
        if mag_a == 0 or mag_b == 0:
            return 0
        return dot / (math.sqrt(mag_a) * math.sqrt(mag_b))
