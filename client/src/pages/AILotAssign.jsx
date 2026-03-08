import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Splitter } from "antd";
import SplitTable from "../components/SplitTable";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ─── 상태 상수 ─── */
const STATUS = {
  BEFORE_ASSIGN: "Assign 전",
  IN_PROGRESS: "실험 진행 중",
  DONE_NO_RESULT: "실험 종료(결과 등록 전)",
  DONE_COMPLETE: "실험 종료(결과 완료)",
};

const FAB_OPTIONS = ["In Fab", "Fab Out", "EPM", "WT"];

const fabStyles = {
  "In Fab": { bg: "bg-blue-100", text: "text-blue-700" },
  "Fab Out": { bg: "bg-purple-100", text: "text-purple-700" },
  EPM: { bg: "bg-teal-100", text: "text-teal-700" },
  WT: { bg: "bg-orange-100", text: "text-orange-700" },
};

const statusStyles = {
  [STATUS.BEFORE_ASSIGN]: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  [STATUS.IN_PROGRESS]: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  [STATUS.DONE_NO_RESULT]: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  [STATUS.DONE_COMPLETE]: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
};

/* ─── AI 캐릭터 (눈 깜박임) ─── */
function TigerCharacter({ onClick, chatVisible }) {
  const [blink, setBlink] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => {
    const schedule = () => {
      const delay = 2500 + Math.random() * 3000;
      timerRef.current = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); schedule(); }, 180);
      }, delay);
    };
    schedule();
    return () => clearTimeout(timerRef.current);
  }, []);
  return (
    <button
      onClick={onClick}
      title={chatVisible ? "AI 패널 숨기기" : "AI 도우미 열기"}
      className="hover:scale-110 active:scale-95 transition-transform cursor-pointer"
    >
      <svg viewBox="0 0 90 64" width="64" height="46">
        <rect x="2" y="2" width="86" height="60" rx="16" fill="#4338CA" />
        <ellipse cx="29" cy="32" rx="9" ry={blink ? 1.5 : 13} fill="white"
          style={{ transition: blink ? "ry 0.06s ease-in" : "ry 0.12s ease-out" }} />
        <ellipse cx="61" cy="32" rx="9" ry={blink ? 1.5 : 13} fill="white"
          style={{ transition: blink ? "ry 0.06s ease-in" : "ry 0.12s ease-out" }} />
      </svg>
    </button>
  );
}

/* ─── 채팅 패널 ─── */
function ChatPanel({ onHide, messages, onSend, quickActions }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-indigo-700 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-sm">AI Lot Assign 도우미</span>
          </div>
          <button
            onClick={onHide}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-indigo-600 text-indigo-200 hover:text-white transition"
            title="패널 숨기기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-indigo-200 mt-0.5">Lot 추천 · 공정 매칭 · 배정 검토</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mr-2 mt-0.5 shrink-0">
                AI
              </div>
            )}
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-indigo-600 text-white rounded-tr-sm"
                : "bg-white border border-gray-200 text-gray-700 rounded-tl-sm shadow-sm"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {quickActions && quickActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${action.style || "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100"}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-3 border-t border-gray-200 bg-white shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            placeholder="질문을 입력하세요... (Enter로 전송)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 모달 컴포넌트 ─── */
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-7xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition">✕</button>
        </div>
        <div className="p-6 overflow-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">{footer}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Summary 모달 내용 ─── */
function SummaryContent({ experiment, project }) {
  const expFields = [
    { label: "Plan ID", value: experiment?.plan_id },
    { label: "팀", value: experiment?.team },
    { label: "요청자", value: experiment?.requester },
    { label: "LOT 코드", value: experiment?.lot_code },
    { label: "모듈", value: experiment?.module },
    { label: "WF 방향", value: experiment?.wf_direction },
    { label: "평가 공정", value: experiment?.eval_process },
    { label: "평가 카테고리", value: experiment?.eval_category },
    { label: "평가 항목", value: experiment?.eval_item },
    { label: "LOT 요청", value: experiment?.lot_request },
    { label: "참고", value: experiment?.reference },
    { label: "Volume Split", value: experiment?.volume_split },
    { label: "배정 WF", value: experiment?.assign_wf },
  ];
  const projFields = [
    { label: "과제명", value: project?.iacpj_nm },
    { label: "모듈", value: project?.iacpj_mod_n },
    { label: "PM", value: project?.iacpj_ch_n },
    { label: "과제 코드", value: project?.iacpj_itf_uno },
    { label: "개발 분류", value: project?.iacpj_tgt_n },
    { label: "과제 등급", value: project?.ia_ta_grd_n },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-emerald-700 mb-3">🧪 실험 조건</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {expFields.map(({ label, value }) => value && (
            <div key={label}>
              <span className="text-[11px] text-gray-500">{label}</span>
              <p className="text-sm font-medium text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>
      {project && (
        <div>
          <h4 className="text-sm font-bold text-indigo-700 mb-3">📁 과제 정보</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {projFields.map(({ label, value }) => value && (
              <div key={label}>
                <span className="text-[11px] text-gray-500">{label}</span>
                <p className="text-sm font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>
          {project.project_purpose && (
            <div className="mt-3">
              <span className="text-[11px] text-gray-500">과제 목적</span>
              <p className="text-sm text-gray-700 mt-0.5">{project.project_purpose}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Autocomplete 검색 ─── */
function TableSearch({ data, fields, onFilter }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onFilter(val);
    if (!val.trim()) { setSuggestions([]); setOpen(false); return; }
    const seen = new Set();
    for (const row of data) {
      for (const field of fields) {
        const cell = String(row[field] || "");
        if (cell.toLowerCase().includes(val.toLowerCase()) && cell !== val) seen.add(cell);
      }
    }
    setSuggestions([...seen].slice(0, 8));
    setOpen(true);
  };

  const select = (val) => { setQuery(val); onFilter(val); setOpen(false); };
  const clear = () => { setQuery(""); onFilter(""); setSuggestions([]); setOpen(false); };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-1">
        <input type="text" value={query} onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="검색..."
          className="px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none w-48"
        />
        {query && (
          <button onClick={clear} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 w-60 max-h-52 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button key={i} onMouseDown={() => select(s)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 truncate">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  메인 페이지                                        */
/* ═══════════════════════════════════════════════════ */
function AILotAssign() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingFilter, setPendingFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  // 모달 상태
  const [splitModal, setSplitModal] = useState(null);
  const [summaryModal, setSummaryModal] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [lineLots, setLineLots] = useState([]);

  // AI 채팅 상태
  const [chatVisible, setChatVisible] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "안녕하세요! Lot Assign AI 도우미입니다.\n\n라인 자재 현황을 분석하여 실험에 최적화된 Lot을 추천해드립니다.\n\n'Assign' 버튼을 클릭하면 자재 선택을 도와드립니다!",
    },
  ]);
  const [quickActions, setQuickActions] = useState([]);

  const fetchExperiments = useCallback(async () => {
    try {
      const res = await axios.get("/api/experiments");
      setExperiments(res.data);
    } catch (err) {
      console.error("실험 목록 로드 실패:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchExperiments(); }, [fetchExperiments]);

  const pendingExperiments = useMemo(
    () => experiments.filter((e) => (e.status || STATUS.BEFORE_ASSIGN) === STATUS.BEFORE_ASSIGN),
    [experiments],
  );
  const activeExperiments = useMemo(
    () => experiments.filter((e) => (e.status || STATUS.BEFORE_ASSIGN) !== STATUS.BEFORE_ASSIGN),
    [experiments],
  );

  const handleFabChange = useCallback(async (id, fabStatus) => {
    try {
      await axios.patch(`/api/experiments/${id}/fab-status`, { fab_status: fabStatus });
      fetchExperiments();
    } catch (err) {
      console.error("Fab 상태 변경 실패:", err);
    }
  }, [fetchExperiments]);

  /* ─── Assign 모달 열기 + AI 추천 ─── */
  const openAssignModal = useCallback(async (experimentData) => {
    try {
      const [lotsRes, expRes] = await Promise.all([
        axios.get("/api/line-lots"),
        axios.get(`/api/experiments/${experimentData.id}`),
      ]);
      const splits = expRes.data.splits || [];
      const targetStep = splits.length > 0 ? splits[0].oper_nm : null;
      const lots = lotsRes.data;
      setLineLots(lots);
      setAssignModal({
        experimentId: experimentData.id,
        evalItem: experimentData.eval_item || "미입력",
        projectName: experimentData.iacpj_nm,
        targetStep,
      });

      // AI 추천 메시지
      const sorted = [...lots].sort((a, b) => new Date(a.estimated_arrival) - new Date(b.estimated_arrival));
      const best = sorted[0];
      if (best) {
        const diff = (new Date(best.estimated_arrival) - Date.now()) / 3600000;
        const hoursText = diff < 1
          ? "곧 도달 예정"
          : diff < 24
            ? `약 ${Math.round(diff)}시간 후 도달`
            : `약 ${Math.round(diff / 24)}일 후 도달`;
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `📦 "${experimentData.eval_item}" 실험 Lot 배정을 시작합니다.\n\n${targetStep ? `📌 Target Step: ${targetStep}\n\n` : ""}라인 자재 ${lots.length}건 중 가장 빠른 자재를 추천합니다:\n\n• Lot: ${best.lot_id}\n• 현재 Step: ${best.current_step}\n• 예상 도달: ${hoursText}\n\n이 자재로 배정할까요?`,
          },
        ]);
        setQuickActions([
          {
            label: `✅ ${best.lot_id} 배정`,
            style: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100",
            onClick: () => {
              handleAssignLotWithChat(experimentData.id, best.lot_id, experimentData.eval_item);
            },
          },
          {
            label: "🔍 직접 선택",
            style: "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100",
            onClick: () => {
              setChatMessages((prev) => [...prev, { role: "user", content: "직접 선택할게요" }, { role: "assistant", content: "모달에서 원하시는 자재를 직접 선택해주세요." }]);
              setQuickActions([]);
            },
          },
        ]);
      }
    } catch (err) {
      console.error("라인 자재 목록 로드 실패:", err);
    }
  }, []);

  const handleAssignLotWithChat = useCallback(async (expId, lotId, evalItem) => {
    try {
      await axios.patch(`/api/experiments/${expId}/assign-lot`, { lot_id: lotId });
      setAssignModal(null);
      setQuickActions([]);
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: `${lotId} 배정` },
        { role: "assistant", content: `✅ "${evalItem}" 실험에 ${lotId}이(가) 배정되었습니다!\n\n실험 진행 현황에서 상태를 확인하세요.` },
      ]);
      fetchExperiments();
    } catch (err) {
      console.error("Lot 배정 실패:", err);
    }
  }, [fetchExperiments]);

  const handleAssignLot = useCallback(async (lotId) => {
    if (!assignModal) return;
    try {
      await axios.patch(`/api/experiments/${assignModal.experimentId}/assign-lot`, { lot_id: lotId });
      setAssignModal(null);
      fetchExperiments();
    } catch (err) {
      console.error("Lot 배정 실패:", err);
      alert("Lot 배정에 실패했습니다.");
    }
  }, [assignModal, fetchExperiments]);

  const openSplitModal = useCallback(async (data, source = "pending") => {
    try {
      const res = await axios.get(`/api/experiments/${data.id}`);
      setSplitModal({ id: data.id, planId: data.plan_id, evalItem: data.eval_item || data.plan_id, splits: res.data.splits || [], splitCompleted: !!data.split_completed, source });
    } catch (err) {
      console.error("Split 데이터 로드 실패:", err);
    }
  }, []);

  const openDetailModal = useCallback(async (data) => {
    try {
      const res = await axios.get(`/api/experiments/${data.id}`);
      setDetailModal({ experiment: res.data, project: res.data.project, splits: res.data.splits || [] });
    } catch (err) {
      console.error("실험 상세 로드 실패:", err);
    }
  }, []);

  const openSummaryModal = useCallback(async (data, source = "active") => {
    try {
      const res = await axios.get(`/api/experiments/${data.id}`);
      setSummaryModal({ id: data.id, experiment: res.data, project: res.data.project, summaryCompleted: !!data.summary_completed, source });
    } catch (err) {
      console.error("실험 상세 로드 실패:", err);
    }
  }, []);

  const handleChatSend = (text) => {
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "현재 데모 모드입니다.\n\n'Assign' 버튼을 클릭하면 AI 추천 자재 배정을 체험해보세요!" },
    ]);
    setQuickActions([]);
  };

  /* ─── 셀 렌더러 ─── */
  const StatusAutoRenderer = useCallback((params) => {
    const currentStatus = params.data.status || STATUS.BEFORE_ASSIGN;
    const style = statusStyles[currentStatus] || statusStyles[STATUS.BEFORE_ASSIGN];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {currentStatus}
      </span>
    );
  }, []);

  const FabSelectRenderer = useCallback((params) => {
    const currentFab = params.data.fab_status || "";
    const style = fabStyles[currentFab] || { bg: "bg-gray-100", text: "text-gray-500" };
    return (
      <select value={currentFab} onChange={(e) => handleFabChange(params.data.id, e.target.value)}
        className={`text-xs font-semibold rounded-lg px-2 py-1 border-0 outline-none cursor-pointer ${style.bg} ${style.text}`}
        style={{ appearance: "auto" }}>
        <option value="" disabled>선택</option>
        {FAB_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
    );
  }, [handleFabChange]);

  const ViewButtonRenderer = useCallback((params) => (
    <button onClick={() => openSplitModal(params.data, "pending")}
      className="w-6 h-6 rounded border-2 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 flex items-center justify-center transition cursor-pointer"
      title="Split Table 보기">
      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    </button>
  ), [openSplitModal]);

  const CheckboxModalRenderer = useCallback((params) => {
    const type = params.colDef.field;
    const isCompleted = type === "split_view" ? !!params.data.split_completed : !!params.data.summary_completed;
    return (
      <button
        onClick={() => { type === "split_view" ? openSplitModal(params.data, "active") : openSummaryModal(params.data, "active"); }}
        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition cursor-pointer ${
          isCompleted ? "border-emerald-500 bg-emerald-500" : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50"
        }`}
        title={type === "split_view" ? "Split Table" : "Summary"}>
        {isCompleted ? (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    );
  }, [openSplitModal, openSummaryModal]);

  /* ─── 컬럼 정의 ─── */
  const lotColDefs = useMemo(() => [
    { headerName: "Lot ID", field: "lot_id", width: 110, cellStyle: { fontWeight: "600", color: "#6366F1" } },
    { headerName: "Current Step", field: "current_step", minWidth: 150, flex: 1 },
    { headerName: "Target Step", field: "target_step", width: 130, cellStyle: { color: "#059669", fontWeight: "500" }, valueGetter: () => assignModal?.targetStep || "-" },
    {
      headerName: "예상 도달", field: "estimated_arrival", width: 135, sort: "asc",
      valueFormatter: (params) => {
        if (!params.value) return "-";
        const d = new Date(params.value);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        return `${mm}/${dd} ${hh}:${mi}`;
      },
      cellStyle: (params) => {
        if (!params.value) return {};
        const diff = new Date(params.value) - Date.now();
        const hours = diff / 3600000;
        if (hours <= 3) return { color: "#DC2626", fontWeight: "600" };
        if (hours <= 12) return { color: "#D97706", fontWeight: "500" };
        return { color: "#6B7280" };
      },
    },
    { headerName: "FAC", field: "fac_id", width: 70 },
    {
      headerName: "", field: "action", width: 90,
      cellRenderer: (params) => (
        <button onClick={() => handleAssignLot(params.data.lot_id)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm cursor-pointer">
          선택
        </button>
      ),
      cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" },
      sortable: false, filter: false,
    },
  ], [handleAssignLot, assignModal]);

  const pendingColDefs = useMemo(() => [
    {
      headerName: "평가 항목", field: "eval_item", minWidth: 150, flex: 2,
      cellStyle: { fontWeight: "600", color: "#4F46E5", cursor: "pointer" },
      cellRenderer: (params) => (
        <span onClick={() => openDetailModal(params.data)} className="hover:underline cursor-pointer">{params.value}</span>
      ),
    },
    { headerName: "과제명", field: "iacpj_nm", minWidth: 130, flex: 2 },
    { headerName: "평가 카테고리", field: "eval_category", width: 120 },
    { headerName: "평가 공정", field: "eval_process", width: 130 },
    { headerName: "모듈", field: "module", width: 80 },
    { headerName: "랏코드", field: "lot_code", width: 120 },
    { headerName: "신청자", field: "requester", width: 85 },
    { headerName: "배정 WF", field: "assign_wf", width: 90 },
    {
      headerName: "Assign", field: "status", width: 80,
      cellRenderer: (params) => (
        <button onClick={() => openAssignModal(params.data)}
          className="w-6 h-6 rounded border-2 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 flex items-center justify-center transition cursor-pointer"
          title="Lot Assign">
          <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </button>
      ),
      cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" },
      sortable: false, filter: false,
    },
    {
      headerName: "Split Table", field: "split_view", width: 95,
      cellRenderer: ViewButtonRenderer,
      cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" },
      sortable: false, filter: false,
    },
  ], [openAssignModal, ViewButtonRenderer, openDetailModal]);

  const activeColDefs = useMemo(() => [
    { headerName: "평가 항목", field: "eval_item", minWidth: 180, flex: 2, cellStyle: { fontWeight: "600" } },
    { headerName: "과제명", field: "iacpj_nm", minWidth: 160, flex: 2 },
    { headerName: "Plan ID", field: "plan_id", width: 130, cellStyle: { color: "#6366F1", fontWeight: "500" } },
    { headerName: "Fab", field: "fab_status", width: 100, cellRenderer: FabSelectRenderer, cellStyle: { display: "flex", alignItems: "center" } },
    { headerName: "Status", field: "status", width: 190, cellRenderer: StatusAutoRenderer, cellStyle: { display: "flex", alignItems: "center" } },
    {
      headerName: "Split Table", field: "split_view", width: 100,
      cellRenderer: CheckboxModalRenderer,
      cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" },
      sortable: false, filter: false,
    },
    {
      headerName: "Summary", field: "summary_view", width: 100,
      cellRenderer: CheckboxModalRenderer,
      cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" },
      sortable: false, filter: false,
    },
  ], [FabSelectRenderer, StatusAutoRenderer, CheckboxModalRenderer]);

  const defaultColDef = useMemo(() => ({ resizable: true, sortable: true, suppressMovable: true }), []);

  const getRowStyle = useCallback((params) => {
    if (params.node.rowIndex % 2 === 0) return { backgroundColor: "#FAFAFA" };
    return {};
  }, []);

  const pendingFields = useMemo(() => ["eval_item", "iacpj_nm", "eval_category", "eval_process", "module", "lot_code", "requester"], []);
  const activeFields = useMemo(() => ["eval_item", "iacpj_nm", "plan_id", "fab_status", "status"], []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-lg">로딩 중...</div>;
  }

  return (
    <>
      <Splitter style={{ height: "calc(100vh - 112px)" }}>
        {/* ─── 왼쪽: 메인 테이블 ─── */}
        <Splitter.Panel defaultSize="65%" min="40%" style={{ paddingRight: chatVisible ? 10 : 0, overflow: "auto" }}>
          <div className="flex flex-col" style={{ height: "100%" }}>
            {/* ─── Lot Assign 요청 ─── */}
            <div className="flex-1 min-h-0 flex flex-col pb-2">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Lot Assign 요청</h2>
                  <p className="text-sm text-gray-500">
                    Lot 배정 대기 중인 실험 —{" "}
                    <b className="text-gray-700">{pendingExperiments.length}건</b>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!chatVisible && (
                    <TigerCharacter onClick={() => setChatVisible(true)} chatVisible={chatVisible} />
                  )}
                  <TableSearch data={pendingExperiments} fields={pendingFields} onFilter={setPendingFilter} />
                </div>
              </div>

              <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 p-3 overflow-hidden">
                <div style={{ width: "100%", height: "100%" }}>
                  <AgGridReact
                    rowData={pendingExperiments}
                    columnDefs={pendingColDefs}
                    defaultColDef={defaultColDef}
                    getRowStyle={getRowStyle}
                    headerHeight={40}
                    rowHeight={42}
                    suppressCellFocus={true}
                    animateRows={true}
                    quickFilterText={pendingFilter}
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-200 shrink-0" />

            {/* ─── 진행 현황 ─── */}
            <div className="flex-1 min-h-0 flex flex-col pt-2">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">실험 진행 현황</h2>
                  <p className="text-sm text-gray-500">
                    자재가 배정되어 진행 중인 실험 —{" "}
                    <b className="text-indigo-600">{activeExperiments.length}건</b>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 accent-indigo-600 cursor-pointer" />
                    완료된 실험 보기
                  </label>
                  <TableSearch data={activeExperiments} fields={activeFields} onFilter={setActiveFilter} />
                </div>
              </div>

              <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 p-3 overflow-hidden">
                <div style={{ width: "100%", height: "100%" }}>
                  <AgGridReact
                    rowData={activeExperiments}
                    columnDefs={activeColDefs}
                    defaultColDef={defaultColDef}
                    getRowStyle={getRowStyle}
                    headerHeight={40}
                    rowHeight={42}
                    suppressCellFocus={true}
                    animateRows={true}
                    quickFilterText={activeFilter}
                  />
                </div>
              </div>
            </div>
          </div>
        </Splitter.Panel>

        {/* ─── 오른쪽: AI 채팅 ─── */}
        {chatVisible && (
          <Splitter.Panel min="20%" max="55%" collapsible style={{ paddingLeft: 10 }}>
            <ChatPanel
              onHide={() => setChatVisible(false)}
              messages={chatMessages}
              onSend={handleChatSend}
              quickActions={quickActions}
            />
          </Splitter.Panel>
        )}
      </Splitter>

      {/* ─── Split Table Modal ─── */}
      {splitModal && (
        <Modal title={`📋 Split Table — ${splitModal.evalItem} (${splitModal.planId})`} onClose={() => setSplitModal(null)}>
          {splitModal.splits.length > 0 ? (
            <SplitTable splits={splitModal.splits} maxHeight={640} />
          ) : (
            <p className="text-gray-400 text-center py-8">등록된 Split 데이터가 없습니다.</p>
          )}
        </Modal>
      )}

      {/* ─── Summary Modal ─── */}
      {summaryModal && (
        <Modal title={`📝 실험 Summary — ${summaryModal.experiment.eval_item || summaryModal.experiment.plan_id}`} onClose={() => setSummaryModal(null)}>
          <SummaryContent experiment={summaryModal.experiment} project={summaryModal.project} />
          {summaryModal.experiment.summary_text && (
            <div className="mt-6 border-t border-gray-200 pt-5">
              <h4 className="text-sm font-bold text-emerald-700 mb-2">📝 Summary</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-100">
                {summaryModal.experiment.summary_text}
              </p>
            </div>
          )}
        </Modal>
      )}

      {/* ─── 실험 상세 Modal ─── */}
      {detailModal && (
        <Modal title={`🧪 실험 상세 — ${detailModal.experiment.eval_item || detailModal.experiment.plan_id}`} onClose={() => setDetailModal(null)}>
          <div className="space-y-6">
            <SummaryContent experiment={detailModal.experiment} project={detailModal.project} />
            {detailModal.splits.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">
                  Split Table
                  <span className="text-xs text-gray-400 font-normal ml-2">(plan_id: {detailModal.experiment.plan_id || "N/A"})</span>
                </h4>
                <SplitTable splits={detailModal.splits} />
              </div>
            )}
            {detailModal.splits.length === 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">Split Table</h4>
                <p className="text-gray-400 text-sm text-center py-4">등록된 Split 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── Assign Modal ─── */}
      {assignModal && (
        <Modal title={`📦 Lot 배정 — ${assignModal.evalItem}`} onClose={() => setAssignModal(null)}>
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{assignModal.evalItem}</span> 실험에 배정할 Lot을 선택해주세요.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              과제: {assignModal.projectName} · 현재 라인에 있는 자재 {lineLots.length}건
              {assignModal.targetStep && (
                <span className="ml-2">· Target: <span className="text-emerald-600 font-semibold ml-1">{assignModal.targetStep}</span></span>
              )}
            </p>
            <p className="text-[11px] text-gray-300 mt-0.5">💡 예상 도달 시점이 가까운 순으로 정렬됩니다</p>
          </div>
          {lineLots.length > 0 ? (
            <div style={{ width: "100%", height: Math.max(lineLots.length * 42 + 50, 150), maxHeight: 400 }}>
              <AgGridReact
                rowData={lineLots}
                columnDefs={lotColDefs}
                defaultColDef={defaultColDef}
                headerHeight={40}
                rowHeight={42}
                suppressCellFocus={true}
                animateRows={true}
              />
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">배정 가능한 자재가 없습니다.</p>
          )}
        </Modal>
      )}
    </>
  );
}

export default AILotAssign;
