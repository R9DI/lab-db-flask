import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Splitter } from "antd";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ─── Split Table 색상 ─── */
const SPLIT_COLORS = {
  base: { row: "#EFF6FF", cell: "#DBEAFE", text: "#1E40AF" },
  s1: { row: "#FFFBEB", cell: "#FEF3C7", text: "#92400E" },
  s2: { row: "#F0FDF4", cell: "#D1FAE5", text: "#065F46" },
  s3: { row: "#F5F3FF", cell: "#EDE9FE", text: "#5B21B6" },
};
const DEFAULT_SPLIT = { row: "#F9FAFB", cell: "#F3F4F6", text: "#374151" };
const getSplitColor = (val) =>
  SPLIT_COLORS[val?.toLowerCase()] || DEFAULT_SPLIT;

/* ─── 데모 실험 5건 ─── */
const DEMO_EXPERIMENTS = [
  {
    id: 1,
    plan_id: "RSAB001",
    iacpj_nm: "SN ETCH 개선 실험",
    eval_item: "SN BSI ETCH CD",
    eval_process: "SN ETCH",
    eval_category: "CD",
    team: "ETCH",
    requester: "김민수",
    lot_code: "RSAB001",
    module: "BSI",
    wf_direction: "P→N",
    request_date: "2026-02-20",
    status: "실험 진행 중",
    split_count: 6,
  },
  {
    id: 2,
    plan_id: "RSAB002",
    iacpj_nm: "SN ETCH 개선 실험",
    eval_item: "SN BSI ETCH Profile",
    eval_process: "SN ETCH",
    eval_category: "Profile",
    team: "ETCH",
    requester: "이지은",
    lot_code: "RSAB002",
    module: "BSI",
    wf_direction: "N→P",
    request_date: "2026-02-21",
    status: "실험 진행 중",
    split_count: 4,
  },
  {
    id: 3,
    plan_id: "RSAB003",
    iacpj_nm: "SN ETCH 개선 실험",
    eval_item: "SN FSI ETCH Depth",
    eval_process: "SN ETCH",
    eval_category: "Depth",
    team: "ETCH",
    requester: "박준혁",
    lot_code: "RSAB003",
    module: "FSI",
    wf_direction: "P→N",
    request_date: "2026-02-22",
    status: "실험 진행 중",
    split_count: 5,
  },
  {
    id: 4,
    plan_id: "RSAB004",
    iacpj_nm: "SN ETCH 개선 실험",
    eval_item: "SN Selectivity 개선",
    eval_process: "SN ETCH",
    eval_category: "Selectivity",
    team: "ETCH",
    requester: "최유리",
    lot_code: "RSAB004",
    module: "BSI",
    wf_direction: "P→N",
    request_date: "2026-02-23",
    status: "실험 진행 중",
    split_count: 4,
  },
  {
    id: 5,
    plan_id: "RSAB005",
    iacpj_nm: "SN ETCH 개선 실험",
    eval_item: "SN Uniformity 평가",
    eval_process: "SN ETCH",
    eval_category: "Uniformity",
    team: "ETCH",
    requester: "김민수",
    lot_code: "RSAB005",
    module: "BSI",
    wf_direction: "N→P",
    request_date: "2026-02-24",
    status: "실험 진행 중",
    split_count: 3,
  },
];

/* ─── 데모 Split Table (RSAB001) — 일부 조건 비어있음 ─── */
const DEMO_SPLITS = {
  RSAB001: [
    {
      sno: 1,
      plan_id: "RSAB001",
      fac_id: "r3",
      oper_id: "p301200b",
      oper_nm: "SN_ETCH",
      eps_lot_gbn_cd: "base",
      work_cond_desc: "CF4/O2 = 150/30sccm, 500W",
      eqp_id: "ETCH01",
      recipe_id: "SN_BSI_STD",
      note: "기준 조건",
    },
    {
      sno: 2,
      plan_id: "RSAB001",
      fac_id: "r3",
      oper_id: "p301200b",
      oper_nm: "SN_ETCH",
      eps_lot_gbn_cd: "s1",
      work_cond_desc: "CF4/O2 = 200/30sccm, 500W",
      eqp_id: "ETCH01",
      recipe_id: "SN_BSI_S1",
      note: "CF4 증가",
    },
    {
      sno: 3,
      plan_id: "RSAB001",
      fac_id: "r3",
      oper_id: "p301200b",
      oper_nm: "SN_ETCH",
      eps_lot_gbn_cd: "s2",
      work_cond_desc: "",
      eqp_id: "ETCH01",
      recipe_id: "SN_BSI_S2",
      note: "",
    },
    {
      sno: 4,
      plan_id: "RSAB001",
      fac_id: "r3",
      oper_id: "p802300c",
      oper_nm: "SN_STRIP",
      eps_lot_gbn_cd: "base",
      work_cond_desc: "O2 Plasma 300W, 60s",
      eqp_id: "STRIP01",
      recipe_id: "STR_STD",
      note: "표준 Strip",
    },
    {
      sno: 5,
      plan_id: "RSAB001",
      fac_id: "r3",
      oper_id: "p802300c",
      oper_nm: "SN_STRIP",
      eps_lot_gbn_cd: "s1",
      work_cond_desc: "",
      eqp_id: "STRIP01",
      recipe_id: "STR_S1",
      note: "",
    },
    {
      sno: 6,
      plan_id: "RSAB001",
      fac_id: "r3",
      oper_id: "r206100a",
      oper_nm: "SN_CLEAN",
      eps_lot_gbn_cd: "base",
      work_cond_desc: "SC1 65℃ 10min",
      eqp_id: "WET01",
      recipe_id: "CLN_STD",
      note: "후처리",
    },
  ],
  RSAB002: [
    {
      sno: 1,
      plan_id: "RSAB002",
      fac_id: "r3",
      oper_id: "p301200b",
      oper_nm: "SN_ETCH",
      eps_lot_gbn_cd: "base",
      work_cond_desc: "CF4/CHF3 = 100/50sccm",
      eqp_id: "ETCH02",
      recipe_id: "PRF_STD",
      note: "Profile 기준",
    },
    {
      sno: 2,
      plan_id: "RSAB002",
      fac_id: "r3",
      oper_id: "p301200b",
      oper_nm: "SN_ETCH",
      eps_lot_gbn_cd: "s1",
      work_cond_desc: "CF4/CHF3 = 100/80sccm",
      eqp_id: "ETCH02",
      recipe_id: "PRF_S1",
      note: "CHF3 증가",
    },
    {
      sno: 3,
      plan_id: "RSAB002",
      fac_id: "r3",
      oper_id: "p301200b",
      oper_nm: "SN_ETCH",
      eps_lot_gbn_cd: "s2",
      work_cond_desc: "CF4/CHF3 = 150/50sccm",
      eqp_id: "ETCH02",
      recipe_id: "PRF_S2",
      note: "CF4 증가",
    },
    {
      sno: 4,
      plan_id: "RSAB002",
      fac_id: "r3",
      oper_id: "p802300c",
      oper_nm: "SN_STRIP",
      eps_lot_gbn_cd: "base",
      work_cond_desc: "O2 Plasma 350W",
      eqp_id: "STRIP02",
      recipe_id: "STR_STD2",
      note: "",
    },
  ],
};

/* ─── 데모 Checklist — monitoringWafers: 측정 예정 웨이퍼 목록 ─── */
const DEMO_CHECKLIST = {
  RSAB001: [
    {
      exp_type: "INLINE",
      step: "SN_ETCH",
      parameter: "CD",
      unit: "nm",
      target: "45",
      lower_spec: "40",
      upper_spec: "50",
      result: "",
      status: "monitoring_set",
      monitoringWafers: [3, 12],
    },
    {
      exp_type: "INLINE",
      step: "SN_ETCH",
      parameter: "Depth",
      unit: "Å",
      target: "1500",
      lower_spec: "1400",
      upper_spec: "1600",
      result: "",
      status: "monitoring_set",
      monitoringWafers: [5, 18],
    },
    {
      exp_type: "INLINE",
      step: "SN_BSI_ETCH_CD",
      parameter: "CD Uniformity",
      unit: "%",
      target: "3",
      lower_spec: "",
      upper_spec: "5",
      result: "",
      status: "not_set",
      monitoringWafers: [],
    },
    {
      exp_type: "EPM",
      step: "SN_STRIP",
      parameter: "Residue",
      unit: "ea",
      target: "0",
      lower_spec: "",
      upper_spec: "3",
      result: "",
      status: "monitoring_set",
      monitoringWafers: [3, 21],
    },
    {
      exp_type: "WT",
      step: "SN_CLEAN",
      parameter: "Particle",
      unit: "ea",
      target: "10",
      lower_spec: "",
      upper_spec: "20",
      result: "",
      status: "monitoring_set",
      monitoringWafers: [7, 15],
    },
  ],
};

const EXPERIMENT_TYPES = ["INLINE", "EPM", "WT", "NUDD", "신뢰성"];
const UNIT_OPTIONS = [
  "Å",
  "nm",
  "μm",
  "mm",
  "kÅ",
  "kA",
  "A",
  "V",
  "mV",
  "%",
  "ea",
  "℃",
  "sec",
  "rpm",
  "W",
];

/* ─── AI 봇 캐릭터 ─── */
function TigerCharacter({ onClick, chatVisible }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let timer;
    const schedule = () => {
      const delay = 2800 + Math.random() * 2200;
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          schedule();
        }, 180);
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return (
    <button
      onClick={onClick}
      title={chatVisible ? "AI 패널 숨기기" : "AI 도우미 열기"}
      className="hover:scale-110 active:scale-95 transition-transform cursor-pointer"
    >
      <svg viewBox="0 0 90 64" width="64" height="46">
        <rect x="2" y="2" width="86" height="60" rx="16" fill="#4338CA" />
        <ellipse
          cx="29"
          cy="32"
          rx="9"
          ry={blink ? 1.5 : 13}
          fill="white"
          style={{
            transition: blink ? "ry 0.06s ease-in" : "ry 0.12s ease-out",
          }}
        />
        <ellipse
          cx="61"
          cy="32"
          rx="9"
          ry={blink ? 1.5 : 13}
          fill="white"
          style={{
            transition: blink ? "ry 0.06s ease-in" : "ry 0.12s ease-out",
          }}
        />
      </svg>
    </button>
  );
}

/* ─── 채팅 패널 (인터랙티브 시나리오 지원) ─── */
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-indigo-700 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-sm">AI 실험 도우미</span>
          </div>
          <button
            onClick={onHide}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-indigo-600 text-indigo-200 hover:text-white transition"
            title="패널 숨기기"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-indigo-200 mt-0.5">
          Split 조건 · Checklist 검증 · 모니터링 설정
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mr-2 mt-0.5 shrink-0">
                AI
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-white border border-gray-200 text-gray-700 rounded-tl-sm shadow-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {/* 퀵 액션 버튼 */}
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

/* ─── 모니터링 웨이퍼 모달 ─── */
function MonitoringModal({ item, rowIndex, onClose, onToggleWafer }) {
  if (!item) return null;
  const isSet = item.status === "monitoring_set";
  const wafers = item.monitoringWafers || [];
  const totalWafers = 25;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[90vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className={`px-6 py-4 ${isSet ? "bg-blue-600" : "bg-red-500"} text-white`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">Monitoring 설정</h3>
              <p className="text-xs mt-0.5 opacity-80">
                {isSet ? "✅ 모니터링 설정됨" : "⚠️ 모니터링 미설정"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Step / Parameter 정보 */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                Step
              </span>
              <p className="text-sm font-bold text-gray-800 mt-0.5">
                {item.step}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                Parameter
              </span>
              <p className="text-sm font-bold text-gray-800 mt-0.5">
                {item.parameter}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="text-center bg-gray-50 rounded-lg py-2">
              <span className="text-[10px] text-gray-400 block">실험종류</span>
              <span className="text-xs font-semibold text-indigo-600">
                {item.exp_type}
              </span>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2">
              <span className="text-[10px] text-gray-400 block">Target</span>
              <span className="text-xs font-semibold text-gray-700">
                {item.target} {item.unit}
              </span>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2">
              <span className="text-[10px] text-gray-400 block">Lower</span>
              <span className="text-xs font-semibold text-gray-700">
                {item.lower_spec || "-"}
              </span>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2">
              <span className="text-[10px] text-gray-400 block">Upper</span>
              <span className="text-xs font-semibold text-gray-700">
                {item.upper_spec || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* 웨이퍼 그리드 */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-700">
              Wafer 측정 계획
            </span>
            <span className="text-[11px] text-gray-400">
              측정 예정: <b className="text-blue-600">{wafers.length}장</b> /{" "}
              {totalWafers}장
            </span>
          </div>
          <div
            className="grid grid-cols-13 gap-1.5"
            style={{ gridTemplateColumns: "repeat(13, 1fr)" }}
          >
            {Array.from({ length: totalWafers }, (_, i) => {
              const wfNum = i + 1;
              const isMeasured = wafers.includes(wfNum);
              return (
                <button
                  key={wfNum}
                  onClick={() => onToggleWafer(rowIndex, wfNum)}
                  className={`relative w-full aspect-square rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 cursor-pointer ${
                    isMeasured
                      ? "bg-blue-500 border-blue-500 shadow-md shadow-blue-200"
                      : "bg-white border-gray-300 hover:border-blue-300"
                  }`}
                  title={`Wafer #${wfNum} ${isMeasured ? "(측정 예정)" : "(미설정)"}`}
                >
                  {isMeasured && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  )}
                  <span
                    className={`absolute -bottom-4 text-[9px] ${isMeasured ? "text-blue-600 font-bold" : "text-gray-400"}`}
                  >
                    {wfNum}
                  </span>
                </button>
              );
            })}
          </div>
          {/* 범례 */}
          <div className="flex items-center gap-4 mt-6 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full border-2 border-gray-300 bg-white" />
              <span className="text-[10px] text-gray-500">
                웨이퍼 존재 (미측정)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <span className="text-[10px] text-gray-500">측정 예정</span>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  메인 페이지                                        */
/* ═══════════════════════════════════════════════════ */
function AIExperimentProgress() {
  const [selectedExp, setSelectedExp] = useState(DEMO_EXPERIMENTS[0]);
  const [splits, setSplits] = useState([...DEMO_SPLITS.RSAB001]);
  const [checklist, setChecklist] = useState([...DEMO_CHECKLIST.RSAB001]);
  const [chatVisible, setChatVisible] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "안녕하세요! SN ETCH 개선 실험 AI 도우미입니다.\n\n실험 진행 중 Split 조건 누락, Checklist 모니터링 설정 등을 도와드립니다.\n\n실험을 선택하고 '최종 등록'을 눌러보세요!",
    },
  ]);
  const [quickActions, setQuickActions] = useState([]);
  const [popupMessage, setPopupMessage] = useState(null);
  const [monitoringModal, setMonitoringModal] = useState(null); // { rowIndex }
  const splitGridRef = useRef(null);
  const checklistGridRef = useRef(null);

  /* 실험 선택 시 데이터 로드 */
  const handleSelectExp = (exp) => {
    setSelectedExp(exp);
    setSplits([...(DEMO_SPLITS[exp.plan_id] || [])]);
    setChecklist([...(DEMO_CHECKLIST[exp.plan_id] || [])]);
  };

  /* ─── 시나리오 1: 최종 등록 → Split 조건 누락 체크 ─── */
  const handleFinalSubmit = () => {
    const emptyConds = splits.filter(
      (s) => !s.work_cond_desc || s.work_cond_desc.trim() === "",
    );
    if (emptyConds.length > 0) {
      setPopupMessage(
        `Split Table 불완전\n\n${emptyConds.length}건의 조건이 비어있습니다.\nAgent를 확인하세요.`,
      );
      const details = emptyConds
        .map((s) => `• SNO ${s.sno} (${s.oper_nm} / ${s.eps_lot_gbn_cd})`)
        .join("\n");
      const suggestions = emptyConds.map((s) => {
        if (s.oper_nm === "SN_ETCH" && s.eps_lot_gbn_cd === "s2")
          return { sno: s.sno, suggestion: "CF4/O2 = 150/50sccm, 600W" };
        if (s.oper_nm === "SN_STRIP" && s.eps_lot_gbn_cd === "s1")
          return { sno: s.sno, suggestion: "O2 Plasma 400W, 90s" };
        return { sno: s.sno, suggestion: "조건 확인 필요" };
      });
      const suggestionText = suggestions
        .map((s) => `• SNO ${s.sno}: "${s.suggestion}"`)
        .join("\n");

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Split Table에서 조건이 비어있는 행을 발견했습니다.\n\n${details}\n\n다음과 같이 조건을 제안합니다:\n\n${suggestionText}\n\n이대로 넣을까요?`,
        },
      ]);
      setQuickActions([
        {
          label: "✅ 네, 그대로 넣어주세요",
          style:
            "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100",
          onClick: () => {
            const updated = splits.map((s) => {
              const match = suggestions.find((sg) => sg.sno === s.sno);
              if (
                match &&
                (!s.work_cond_desc || s.work_cond_desc.trim() === "")
              ) {
                return { ...s, work_cond_desc: match.suggestion };
              }
              return s;
            });
            setSplits(updated);
            setChatMessages((prev) => [
              ...prev,
              { role: "user", content: "네, 그대로 넣어주세요" },
              {
                role: "assistant",
                content:
                  "✅ 조건을 채워넣었습니다!\n\nSplit Table을 확인해주세요. 수정이 필요하면 직접 편집하셔도 됩니다.",
              },
            ]);
            setQuickActions([]);
            setPopupMessage(null);
          },
        },
        {
          label: "❌ 직접 입력할게요",
          style: "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100",
          onClick: () => {
            setChatMessages((prev) => [
              ...prev,
              { role: "user", content: "직접 입력할게요" },
              {
                role: "assistant",
                content:
                  "알겠습니다! Split Table에서 비어있는 조건 셀을 직접 클릭하여 입력해주세요.",
              },
            ]);
            setQuickActions([]);
            setPopupMessage(null);
          },
        },
      ]);
      return;
    }
    setPopupMessage("✅ 최종 등록이 완료되었습니다!");
    setTimeout(() => setPopupMessage(null), 2000);
  };

  /* ─── 웨이퍼 토글 (모달에서) ─── */
  const handleToggleWafer = useCallback(
    (rowIndex, wfNum) => {
      const updated = [...checklist];
      const row = updated[rowIndex];
      const wafers = [...(row.monitoringWafers || [])];
      const idx = wafers.indexOf(wfNum);
      if (idx >= 0) wafers.splice(idx, 1);
      else wafers.push(wfNum);
      wafers.sort((a, b) => a - b);
      updated[rowIndex] = {
        ...row,
        monitoringWafers: wafers,
        status: wafers.length > 0 ? "monitoring_set" : "not_set",
      };
      setChecklist(updated);
    },
    [checklist],
  );

  /* ─── 시나리오 2: Checklist Status 클릭 → 모달 열기 + 미설정이면 챗 알림 ─── */
  const handleStatusClick = useCallback(
    (rowIndex) => {
      const row = checklist[rowIndex];
      if (!row) return;
      // 모달 열기 (파란색/빨간색 모두)
      setMonitoringModal({ rowIndex });
      // 미설정일 때만 챗 알림
      if (row.status !== "not_set") return;
      const step = row.step || "해당 Step";
      const param = row.parameter || "Parameter";
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ "${step}" Step의 "${param}" 항목은 체크리스트에 기재되어 있으나\n공정 계획상 측정이 걸려있지 않습니다.\n\nSet monitoring을 수행해드릴까요?\n웨이퍼는 3번, 12번, 21번을 추천합니다.`,
        },
      ]);
      setQuickActions([
        {
          label: "1. 그대로 (추천 웨이퍼)",
          style:
            "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100",
          onClick: () => {
            const updated = [...checklist];
            updated[rowIndex] = {
              ...updated[rowIndex],
              status: "monitoring_set",
            };
            setChecklist(updated);
            setChatMessages((prev) => [
              ...prev,
              { role: "user", content: "1. 그대로 (추천 웨이퍼)" },
              {
                role: "assistant",
                content: `✅ ${step}의 ${param} 모니터링이 설정되었습니다!\n\n• 웨이퍼: #3, #12, #21\n• 측정 항목: ${param}\n\nStatus가 🔵으로 변경되었습니다.`,
              },
            ]);
            setQuickActions([]);
          },
        },
        {
          label: "2. 슬랏 내가 선택",
          style:
            "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100",
          onClick: () => {
            setChatMessages((prev) => [
              ...prev,
              { role: "user", content: "2. 슬랏 내가 선택" },
              {
                role: "assistant",
                content:
                  "웨이퍼 슬랏을 선택해주세요:\n\n사용 가능한 슬랏: 1~25번\n추천: 3, 12, 21 (균등 분포)\n\n원하시는 슬랏 번호를 입력해주세요.\n예: 1, 5, 13",
              },
            ]);
            setQuickActions([
              ...[
                { nums: "1, 7, 13" },
                { nums: "3, 12, 21" },
                { nums: "5, 15, 25" },
              ].map((opt) => ({
                label: `슬랏 ${opt.nums}`,
                style:
                  "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
                onClick: () => {
                  const updated = [...checklist];
                  updated[rowIndex] = {
                    ...updated[rowIndex],
                    status: "monitoring_set",
                  };
                  setChecklist(updated);
                  setChatMessages((prev) => [
                    ...prev,
                    { role: "user", content: `슬랏 ${opt.nums}` },
                    {
                      role: "assistant",
                      content: `✅ 모니터링 설정 완료!\n\n• 웨이퍼: #${opt.nums}\n• ${step} / ${param}\n\nStatus가 🔵으로 변경되었습니다.`,
                    },
                  ]);
                  setQuickActions([]);
                },
              })),
            ]);
          },
        },
        {
          label: "3. 그대로 유지",
          style: "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100",
          onClick: () => {
            setChatMessages((prev) => [
              ...prev,
              { role: "user", content: "3. 그대로 유지" },
              {
                role: "assistant",
                content:
                  "알겠습니다. 모니터링 미설정 상태로 유지합니다.\n필요시 언제든 Status를 클릭하여 설정할 수 있습니다.",
              },
            ]);
            setQuickActions([]);
          },
        },
      ]);
    },
    [checklist],
  );

  const handleChatSend = (text) => {
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      {
        role: "assistant",
        content:
          "현재 데모 모드입니다.\n\n'최종 등록' 버튼을 누르거나, Checklist의 🔴 Status를 클릭하여 시나리오를 체험해보세요!",
      },
    ]);
    setQuickActions([]);
  };

  /* ─── Split Table 컬럼 ─── */
  const splitColDefs = useMemo(
    () => [
      {
        headerName: "SNO",
        field: "sno",
        width: 60,
        cellStyle: { textAlign: "center" },
      },
      { headerName: "FAC", field: "fac_id", width: 60 },
      { headerName: "OPER_ID", field: "oper_id", width: 110 },
      { headerName: "공정명", field: "oper_nm", width: 110 },
      {
        headerName: "Split",
        field: "eps_lot_gbn_cd",
        width: 75,
        cellStyle: (p) => {
          const c = getSplitColor(p.value);
          return {
            backgroundColor: c.cell,
            color: c.text,
            fontWeight: "600",
            textAlign: "center",
          };
        },
      },
      {
        headerName: "조건",
        field: "work_cond_desc",
        minWidth: 200,
        flex: 1,
        editable: true,
        cellStyle: (p) => {
          if (!p.value || p.value.trim() === "")
            return {
              backgroundColor: "#FEF2F2",
              color: "#DC2626",
              fontStyle: "italic",
            };
          return {};
        },
        valueFormatter: (p) =>
          !p.value || p.value.trim() === "" ? "⚠️ 조건 미입력" : p.value,
      },
      { headerName: "장비", field: "eqp_id", width: 90 },
      { headerName: "Recipe", field: "recipe_id", width: 130 },
      {
        headerName: "Note",
        field: "note",
        minWidth: 120,
        flex: 1,
        editable: true,
      },
    ],
    [],
  );

  /* ─── Checklist 컬럼 ─── */
  const StatusRenderer = useCallback((params) => {
    const status = params.data?.status;
    const isSet = status === "monitoring_set";
    return (
      <div
        className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
          isSet
            ? "bg-blue-500 border-blue-500"
            : "bg-red-500 border-red-500 animate-pulse"
        }`}
      >
        {isSet ? (
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <span className="text-white text-[9px] font-bold">!</span>
        )}
      </div>
    );
  }, []);

  const checklistColDefs = useMemo(
    () => [
      {
        headerName: "Status",
        field: "status",
        width: 80,
        cellRenderer: StatusRenderer,
        cellStyle: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        },
      },
      {
        field: "exp_type",
        headerName: "실험종류",
        width: 110,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: EXPERIMENT_TYPES },
        cellStyle: (p) => {
          const colors = {
            INLINE: "#3B82F6",
            EPM: "#8B5CF6",
            WT: "#F59E0B",
            NUDD: "#10B981",
            신뢰성: "#EF4444",
          };
          const c = colors[p.value];
          return c
            ? { color: c, fontWeight: 600, textAlign: "center" }
            : { textAlign: "center" };
        },
      },
      {
        field: "step",
        headerName: "Step",
        flex: 1,
        minWidth: 130,
        editable: true,
      },
      {
        field: "parameter",
        headerName: "Parameter",
        flex: 1,
        minWidth: 140,
        editable: true,
      },
      {
        field: "unit",
        headerName: "Unit",
        width: 80,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: UNIT_OPTIONS },
        cellStyle: { textAlign: "center", color: "#6B7280" },
      },
      {
        field: "target",
        headerName: "Target",
        width: 90,
        editable: true,
        cellStyle: { textAlign: "center" },
      },
      {
        field: "lower_spec",
        headerName: "Lower",
        width: 90,
        editable: true,
        cellStyle: { textAlign: "center" },
      },
      {
        field: "upper_spec",
        headerName: "Upper",
        width: 90,
        editable: true,
        cellStyle: { textAlign: "center" },
      },
      {
        field: "result",
        headerName: "Result",
        width: 100,
        editable: true,
        cellStyle: (p) => {
          const val = parseFloat(p.value);
          if (isNaN(val)) return { textAlign: "center" };
          const lo = parseFloat(p.data?.lower_spec);
          const hi = parseFloat(p.data?.upper_spec);
          const inSpec = (isNaN(lo) || val >= lo) && (isNaN(hi) || val <= hi);
          return {
            textAlign: "center",
            fontWeight: 700,
            color: inSpec ? "#059669" : "#DC2626",
            backgroundColor: inSpec ? "#F0FDF4" : "#FEF2F2",
          };
        },
      },
    ],
    [StatusRenderer],
  );

  /* ─── 실험 목록 컬럼 ─── */
  const expColDefs = useMemo(
    () => [
      { field: "plan_id", headerName: "Plan ID", width: 120, pinned: "left" },
      { field: "eval_item", headerName: "평가 아이템", flex: 1, minWidth: 160 },
      { field: "eval_process", headerName: "평가 공정", width: 120 },
      { field: "eval_category", headerName: "분류", width: 100 },
      { field: "requester", headerName: "요청자", width: 90 },
      { field: "module", headerName: "모듈", width: 80 },
      {
        field: "split_count",
        headerName: "Split수",
        width: 80,
        type: "numericColumn",
      },
    ],
    [],
  );

  const getSplitRowStyle = useCallback((params) => {
    const prev = params.api.getDisplayedRowAtIndex(params.rowIndex - 1);
    const borderTop =
      prev && prev.data.oper_id !== params.data.oper_id
        ? "2px solid #64748B"
        : undefined;
    const c = getSplitColor(params.data.eps_lot_gbn_cd);
    return { backgroundColor: c.row, borderTop };
  }, []);

  return (
    <>
      <Splitter style={{ height: "calc(100vh - 112px)" }}>
        <Splitter.Panel
          defaultSize="65%"
          min="40%"
          style={{ paddingRight: chatVisible ? 10 : 0, overflow: "auto" }}
        >
          <div className="flex flex-col gap-4 pb-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between sticky top-0 bg-gray-50 z-10 pb-2">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  SN ETCH 개선 실험
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  AI 도우미와 함께 실험을 검증합니다
                </p>
              </div>
              {!chatVisible && (
                <TigerCharacter
                  onClick={() => setChatVisible(true)}
                  chatVisible={chatVisible}
                />
              )}
            </div>

            {/* 실험 목록 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <h3 className="text-sm font-semibold text-gray-700">
                  실험 목록{" "}
                  <span className="text-gray-400 font-normal">
                    ({DEMO_EXPERIMENTS.length}건)
                  </span>
                </h3>
              </div>
              <div
                className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200"
                style={{ height: 220 }}
              >
                <AgGridReact
                  rowData={DEMO_EXPERIMENTS}
                  columnDefs={expColDefs}
                  defaultColDef={{
                    sortable: true,
                    resizable: true,
                    filter: true,
                  }}
                  rowSelection="single"
                  onRowClicked={(e) => handleSelectExp(e.data)}
                  getRowStyle={(params) =>
                    params.data?.id === selectedExp?.id
                      ? { background: "#EEF2FF" }
                      : {}
                  }
                  headerHeight={36}
                  rowHeight={36}
                  suppressMovableColumns
                  animateRows
                />
              </div>
            </div>

            {/* ── Split Table 섹션 ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    📋 Split Table{" "}
                    <span className="text-gray-400 font-normal">
                      ({splits.length}건)
                    </span>
                  </h3>
                  <span className="text-xs text-gray-400">
                    plan_id:{" "}
                    <b className="text-amber-700">{selectedExp?.plan_id}</b>
                  </span>
                </div>
                <button
                  onClick={handleFinalSubmit}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition"
                >
                  최종 등록
                </button>
              </div>
              <div
                className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200"
                style={{ height: Math.max(180, splits.length * 36 + 40) }}
              >
                <AgGridReact
                  ref={splitGridRef}
                  rowData={splits}
                  columnDefs={splitColDefs}
                  defaultColDef={{ resizable: true, suppressMovable: true }}
                  getRowStyle={getSplitRowStyle}
                  onCellValueChanged={(e) => {
                    const rows = [];
                    e.api.forEachNode((n) => rows.push(n.data));
                    setSplits(rows);
                  }}
                  headerHeight={36}
                  rowHeight={36}
                  stopEditingWhenCellsLoseFocus
                />
              </div>
            </div>

            {/* ── Checklist 섹션 ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    ✅ Checklist{" "}
                    <span className="text-gray-400 font-normal">
                      ({checklist.length}건)
                    </span>
                  </h3>
                </div>
                <span className="text-xs text-gray-400">
                  🔴 미설정 항목 클릭 → Agent 모니터링 설정
                </span>
              </div>
              <div
                className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200"
                style={{ height: Math.max(180, checklist.length * 36 + 40) }}
              >
                <AgGridReact
                  ref={checklistGridRef}
                  rowData={checklist}
                  columnDefs={checklistColDefs}
                  defaultColDef={{ resizable: true, suppressMovable: true }}
                  headerHeight={36}
                  rowHeight={36}
                  stopEditingWhenCellsLoseFocus
                  onCellClicked={(e) => {
                    if (e.colDef.field === "status") {
                      handleStatusClick(e.node.rowIndex);
                    }
                  }}
                  onCellValueChanged={(e) => {
                    const rows = [];
                    e.api.forEachNode((n) => rows.push(n.data));
                    setChecklist(rows);
                  }}
                />
              </div>
            </div>
          </div>
        </Splitter.Panel>

        {chatVisible && (
          <Splitter.Panel
            min="20%"
            max="55%"
            collapsible
            style={{ paddingLeft: 10 }}
          >
            <ChatPanel
              onHide={() => setChatVisible(false)}
              messages={chatMessages}
              onSend={handleChatSend}
              quickActions={quickActions}
            />
          </Splitter.Panel>
        )}
      </Splitter>

      {/* 팝업 오버레이 — Splitter 밖으로 이동 */}
      {popupMessage && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setPopupMessage(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-3">
              {popupMessage.startsWith("✅") ? "🎉" : "⚠️"}
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {popupMessage}
            </p>
            <button
              onClick={() => setPopupMessage(null)}
              className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 모니터링 모달 — Splitter 밖으로 이동 */}
      {monitoringModal && (
        <MonitoringModal
          item={checklist[monitoringModal.rowIndex]}
          rowIndex={monitoringModal.rowIndex}
          onClose={() => setMonitoringModal(null)}
          onToggleWafer={handleToggleWafer}
        />
      )}
    </>
  );
}

export default AIExperimentProgress;
