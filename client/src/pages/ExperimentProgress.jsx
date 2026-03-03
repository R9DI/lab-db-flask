import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import ProjectCard from "../components/ProjectCard";
import EditableSplitTable from "../components/EditableSplitTable";

ModuleRegistry.registerModules([AllCommunityModule]);

const TABS = [
  { key: "experiments", label: "실험 정보" },
  { key: "checklist", label: "과제 Checklist" },
  { key: "info", label: "과제 정보" },
];

/* ─── 과제 정보 탭 ─── */
function ProjectInfoTab({ project }) {
  if (!project) return null;

  const fields = [
    { label: "과제명", value: project.iacpj_nm },
    { label: "모듈", value: project.iacpj_mod_n },
    { label: "PM", value: project.iacpj_ch_n },
    { label: "과제 코드", value: project.iacpj_itf_uno },
    { label: "개발 분류", value: project.iacpj_tgt_n },
    { label: "검증 수준", value: project.iacpj_level },
    { label: "1차 대상 기술", value: project.iacpj_tech_n },
    { label: "과제 등급", value: project.ia_ta_grd_n },
    { label: "HTRS", value: project.ia_tgt_htr_n },
    { label: "NUDD", value: project.iacpj_nud_n },
    { label: "시작일", value: project.iacpj_bgn_dy },
    { label: "종료일", value: project.iacpj_end_dy },
    { label: "현재 상태", value: project.iacpj_cur_stt },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {fields.map(
          ({ label, value }) =>
            value && (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <span className="text-[11px] text-gray-500 block mb-0.5">
                  {label}
                </span>
                <p className="text-sm font-medium text-gray-800">{value}</p>
              </div>
            ),
        )}
      </div>
      {project.project_purpose && (
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-[11px] text-gray-500 block mb-0.5">
            과제 목적
          </span>
          <p className="text-sm text-gray-700">{project.project_purpose}</p>
        </div>
      )}
      {project.iacpj_ta_goa && (
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-[11px] text-gray-500 block mb-0.5">
            과제 목표
          </span>
          <p className="text-sm text-gray-700">{project.iacpj_ta_goa}</p>
        </div>
      )}
    </div>
  );
}

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

const emptyChecklistRow = {
  exp_type: "",
  step: "",
  parameter: "",
  unit: "",
  target: "",
  lower_spec: "",
  upper_spec: "",
  result: "",
};

const checklistColDefs = [
  {
    field: "exp_type",
    headerName: "실험종류",
    width: 120,
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
  { field: "step", headerName: "Step", flex: 1, minWidth: 130, editable: true },
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
    width: 90,
    editable: true,
    cellEditor: "agSelectCellEditor",
    cellEditorParams: { values: UNIT_OPTIONS },
    cellStyle: { textAlign: "center", color: "#6B7280" },
  },
  {
    field: "target",
    headerName: "Target",
    width: 100,
    editable: true,
    cellStyle: { textAlign: "center" },
  },
  {
    field: "lower_spec",
    headerName: "Lower Spec",
    width: 110,
    editable: true,
    cellStyle: { textAlign: "center" },
  },
  {
    field: "upper_spec",
    headerName: "Upper Spec",
    width: 110,
    editable: true,
    cellStyle: { textAlign: "center" },
  },
  {
    field: "result",
    headerName: "Result",
    width: 110,
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
];

/* ─── LOT 상세 정보 영역 ─── */
function LotDetail({ experiment }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checklistRows, setChecklistRows] = useState([
    { ...emptyChecklistRow },
  ]);
  const [issue, setIssue] = useState("");
  const [inlineData, setInlineData] = useState("");
  const [outlineData, setOutlineData] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryCompleted, setSummaryCompleted] = useState(false);
  const [summarySaving, setSummarySaving] = useState(false);
  const checklistGridRef = useRef(null);

  useEffect(() => {
    if (!experiment) return;
    setLoading(true);
    // 실험 바뀌면 입력 초기화
    setChecklistRows([{ ...emptyChecklistRow }]);
    setIssue("");
    setInlineData("");
    setOutlineData("");
    setSummary("");
    setSummaryCompleted(false);
    setSummarySaving(false);
    axios
      .get(`/api/experiments/${experiment.id}`)
      .then((res) => {
        setDetail(res.data);
        setSummary(res.data.summary_text || "");
        setSummaryCompleted(!!res.data.summary_completed);
      })
      .catch((err) => console.error("실험 상세 로드 실패:", err))
      .finally(() => setLoading(false));
  }, [experiment]);

  if (loading)
    return <div className="text-center text-gray-400 py-8">로딩 중...</div>;
  if (!detail) return null;

  const textareaCls =
    "w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition placeholder-gray-300";

  const SectionHeader = ({ emoji, title, badge }) => (
    <div className="flex items-center gap-2 mb-2">
      <span>{emoji}</span>
      <h4 className="text-sm font-bold text-gray-700">{title}</h4>
      {badge && (
        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
          {badge}
        </span>
      )}
    </div>
  );

  return (
    <div className="mt-4 border-t border-gray-200 pt-5 space-y-6">
      <h3 className="text-base font-bold text-gray-800">
        {detail.plan_id || "N/A"} — LOT Total Information
      </h3>

      {/* Split Table */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-bold text-gray-700">📋 Split Table</h4>
          <span className="text-xs text-gray-400">
            (plan_id: {detail.plan_id || "N/A"})
          </span>
        </div>
        {detail.splits && detail.splits.length > 0 ? (
          <EditableSplitTable
            splits={detail.splits}
            planId={detail.plan_id}
            experimentId={detail.id}
            onSaved={() => {}}
          />
        ) : (
          <p className="text-gray-400 text-sm py-4 text-center">
            등록된 Split 데이터가 없습니다.
          </p>
        )}
      </div>

      {/* 실험 Checklist — 스펙 관리 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader emoji="✅" title="실험 Checklist" badge="스펙 관리" />
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                const sel = checklistGridRef.current?.api?.getSelectedNodes();
                if (sel?.length) {
                  const updated = checklistRows.filter(
                    (_, i) => !sel.some((n) => n.rowIndex === i),
                  );
                  setChecklistRows(
                    updated.length ? updated : [{ ...emptyChecklistRow }],
                  );
                }
              }}
              className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition"
            >
              − 삭제
            </button>
            <button
              onClick={() =>
                setChecklistRows((prev) => [...prev, { ...emptyChecklistRow }])
              }
              className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
            >
              + 행 추가
            </button>
          </div>
        </div>
        <div
          className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-100"
          style={{ height: Math.min(checklistRows.length * 36 + 42, 320) }}
        >
          <AgGridReact
            ref={checklistGridRef}
            rowData={checklistRows}
            columnDefs={checklistColDefs}
            defaultColDef={{ resizable: true, suppressMovable: true }}
            rowSelection="multiple"
            headerHeight={36}
            rowHeight={36}
            stopEditingWhenCellsLoseFocus
            onCellValueChanged={(e) => {
              const updated = [];
              e.api.forEachNode((n) => updated.push(n.data));
              setChecklistRows(updated);
            }}
          />
        </div>
      </div>

      {/* Issue 사항 */}
      <div className="bg-white border border-red-100 rounded-xl p-4">
        <SectionHeader emoji="⚠️" title="Issue 사항" badge="사고 · 특이사항" />
        <textarea
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          rows={3}
          placeholder="사고, 특이사항, 공정 이슈 등을 기록하세요..."
          className={textareaCls}
        />
      </div>

      {/* Inline Data */}
      <div className="bg-white border border-blue-100 rounded-xl p-4">
        <SectionHeader emoji="📊" title="Inline Data" />
        <textarea
          value={inlineData}
          onChange={(e) => setInlineData(e.target.value)}
          rows={4}
          placeholder="Inline 측정 데이터를 입력하세요..."
          className={textareaCls}
        />
      </div>

      {/* Outline Data */}
      <div className="bg-white border border-violet-100 rounded-xl p-4">
        <SectionHeader emoji="📈" title="Outline Data" />
        <textarea
          value={outlineData}
          onChange={(e) => setOutlineData(e.target.value)}
          rows={4}
          placeholder="Outline 측정 데이터를 입력하세요..."
          className={textareaCls}
        />
      </div>

      {/* Summary */}
      <div className="bg-white border border-emerald-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader emoji="📝" title="Summary" />
          <button
            onClick={async () => {
              setSummarySaving(true);
              try {
                await axios.patch(`/api/experiments/${detail.id}/summary`, {
                  summary_text: summary,
                });
                setSummaryCompleted(true);
              } catch (err) {
                console.error("Summary 저장 실패:", err);
                alert("저장에 실패했습니다.");
              }
              setSummarySaving(false);
            }}
            disabled={summarySaving}
            className={`text-xs px-4 py-1.5 rounded-lg font-semibold transition ${
              summarySaving
                ? "bg-gray-300 text-gray-500 cursor-wait"
                : summaryCompleted
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            }`}
          >
            {summarySaving
              ? "저장 중..."
              : summaryCompleted
                ? "✅ 완료됨"
                : "최종 저장"}
          </button>
        </div>
        <textarea
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            setSummaryCompleted(false);
          }}
          rows={4}
          placeholder="실험 결과 요약 및 결론을 작성하세요..."
          className={textareaCls}
        />
      </div>
    </div>
  );
}

const expColDefs = [
  { field: "plan_id", headerName: "Plan ID", width: 160, pinned: "left" },
  { field: "eval_item", headerName: "평가 아이템", flex: 1, minWidth: 160 },
  { field: "eval_process", headerName: "평가 공정", width: 140 },
  { field: "eval_category", headerName: "평가 분류", width: 120 },
  { field: "team", headerName: "팀", width: 100 },
  { field: "requester", headerName: "요청자", width: 100 },
  { field: "lot_code", headerName: "LOT 코드", width: 130 },
  { field: "module", headerName: "모듈", width: 100 },
  { field: "wf_direction", headerName: "WF 방향", width: 110 },
  { field: "request_date", headerName: "요청일", width: 120 },
  {
    field: "split_count",
    headerName: "Split수",
    width: 90,
    type: "numericColumn",
  },
];

const defaultColDef = {
  sortable: true,
  resizable: true,
  filter: true,
};

/* ─── 메인 컴포넌트 ─── */
function ExperimentProgress() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [activeTab, setActiveTab] = useState("experiments");
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const gridRef = useRef(null);

  useEffect(() => {
    axios
      .get("/api/projects")
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => {
          const aLinked = a.experiment_count > 0 && a.split_count > 0 ? 1 : 0;
          const bLinked = b.experiment_count > 0 && b.split_count > 0 ? 1 : 0;
          if (bLinked !== aLinked) return bLinked - aLinked;
          return b.experiment_count - a.experiment_count;
        });
        setProjects(sorted);
      })
      .catch((err) => console.error("과제 목록 로드 실패:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setExperiments([]);
      setSelectedExperiment(null);
      return;
    }
    axios
      .get(
        `/api/experiments?iacpj_nm=${encodeURIComponent(selectedProject.iacpj_nm)}`,
      )
      .then((res) => setExperiments(res.data))
      .catch((err) => console.error("실험 목록 로드 실패:", err));
    setSelectedExperiment(null);
  }, [selectedProject]);

  const filteredProjects = useMemo(() => {
    if (!searchText.trim()) return projects;
    const lower = searchText.toLowerCase();
    return projects.filter((p) => p.iacpj_nm.toLowerCase().includes(lower));
  }, [projects, searchText]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-lg">
        로딩 중...
      </div>
    );
  }

  /* ─── 과제 미선택: 과제 카드 목록 ─── */
  if (!selectedProject) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">실험 관리</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              과제를 선택하여 실험 현황을 확인하세요.
            </p>
          </div>
          <div className="relative w-64">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="과제명 검색..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              selected={false}
              onClick={() => {
                setSelectedProject(project);
                setActiveTab("experiments");
              }}
              onDelete={() => {}}
            />
          ))}
          {filteredProjects.length === 0 && (
            <p className="text-gray-400 text-sm col-span-4 text-center py-10">
              {searchText ? "검색 결과가 없습니다." : "등록된 과제가 없습니다."}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ─── 과제 선택됨: 탭 뷰 ─── */
  return (
    <div className="space-y-5">
      {/* 과제 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedProject(null)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition"
          title="과제 목록으로"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {selectedProject.iacpj_nm}
          </h1>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            {selectedProject.iacpj_mod_n && (
              <span>모듈: {selectedProject.iacpj_mod_n}</span>
            )}
            {selectedProject.iacpj_ch_n && (
              <span>PM: {selectedProject.iacpj_ch_n}</span>
            )}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition cursor-pointer ${
                activeTab === tab.key
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 실험 정보 탭 ─── */}
      {activeTab === "experiments" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <h3 className="text-base font-semibold text-gray-800">
              실험 목록
              <span className="text-sm text-gray-400 font-normal ml-2">
                ({experiments.length}건)
              </span>
            </h3>
            {selectedExperiment && (
              <button
                onClick={() => setSelectedExperiment(null)}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5"
              >
                선택 해제
              </button>
            )}
          </div>

          <div
            className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200"
            style={{ height: 320 }}
          >
            <AgGridReact
              ref={gridRef}
              rowData={experiments}
              columnDefs={expColDefs}
              defaultColDef={defaultColDef}
              rowSelection="single"
              onRowClicked={(e) => {
                if (selectedExperiment?.id === e.data.id) {
                  setSelectedExperiment(null);
                  gridRef.current?.api?.deselectAll();
                } else {
                  setSelectedExperiment(e.data);
                }
              }}
              getRowStyle={(params) =>
                params.data?.id === selectedExperiment?.id
                  ? { background: "#EEF2FF" }
                  : {}
              }
              noRowsOverlayComponent={() => (
                <span className="text-gray-400 text-sm">
                  이 과제에 등록된 실험이 없습니다.
                </span>
              )}
              headerHeight={36}
              rowHeight={36}
              suppressMovableColumns
              animateRows
            />
          </div>

          {selectedExperiment && <LotDetail experiment={selectedExperiment} />}
        </div>
      )}

      {/* ─── 과제 Checklist 탭 ─── */}
      {activeTab === "checklist" && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400 text-sm">준비 중인 기능입니다</p>
        </div>
      )}

      {/* ─── 과제 정보 탭 ─── */}
      {activeTab === "info" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <ProjectInfoTab project={selectedProject} />
        </div>
      )}
    </div>
  );
}

export default ExperimentProgress;
