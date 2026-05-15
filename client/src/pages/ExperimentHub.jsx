import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import ProjectCard from "../components/ProjectCard";
import EditableSplitTable from "../components/EditableSplitTable";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ─── 상수 ─── */
const EXPERIMENT_TYPES = ["INLINE", "EPM", "WT", "NUDD", "신뢰성"];
const UNIT_OPTIONS = ["Å","nm","μm","mm","kÅ","kA","A","V","mV","%","ea","℃","sec","rpm","W"];
const emptyChecklistRow = { exp_type:"", step:"", parameter:"", unit:"", target:"", lower_spec:"", upper_spec:"", result:"" };

const checklistColDefs = [
  { field:"exp_type", headerName:"실험종류", width:120, editable:true, cellEditor:"agSelectCellEditor", cellEditorParams:{values:EXPERIMENT_TYPES},
    cellStyle:p=>{const c={INLINE:"#3B82F6",EPM:"#8B5CF6",WT:"#F59E0B",NUDD:"#10B981","신뢰성":"#EF4444"}[p.value]; return c?{color:c,fontWeight:600,textAlign:"center"}:{textAlign:"center"}} },
  { field:"step", headerName:"Step", flex:1, minWidth:130, editable:true },
  { field:"parameter", headerName:"Parameter", flex:1, minWidth:140, editable:true },
  { field:"unit", headerName:"Unit", width:90, editable:true, cellEditor:"agSelectCellEditor", cellEditorParams:{values:UNIT_OPTIONS}, cellStyle:{textAlign:"center",color:"#6B7280"} },
  { field:"target", headerName:"Target", width:100, editable:true, cellStyle:{textAlign:"center"} },
  { field:"lower_spec", headerName:"Lower Spec", width:110, editable:true, cellStyle:{textAlign:"center"} },
  { field:"upper_spec", headerName:"Upper Spec", width:110, editable:true, cellStyle:{textAlign:"center"} },
  { field:"result", headerName:"Result", width:110, editable:true,
    cellStyle:p=>{const v=parseFloat(p.value);if(isNaN(v))return{textAlign:"center"};const lo=parseFloat(p.data?.lower_spec),hi=parseFloat(p.data?.upper_spec);const ok=(isNaN(lo)||v>=lo)&&(isNaN(hi)||v<=hi);return{textAlign:"center",fontWeight:700,color:ok?"#059669":"#DC2626",backgroundColor:ok?"#F0FDF4":"#FEF2F2"}} },
];

const expColDefs = [
  { field:"plan_id", headerName:"Plan ID", width:160, pinned:"left" },
  { field:"eval_item", headerName:"평가 아이템", flex:1, minWidth:160 },
  { field:"eval_process", headerName:"평가 공정", width:140 },
  { field:"eval_category", headerName:"평가 분류", width:120 },
  { field:"team", headerName:"팀", width:100 },
  { field:"requester", headerName:"요청자", width:100 },
  { field:"lot_code", headerName:"LOT 코드", width:130 },
  { field:"module", headerName:"모듈", width:100 },
  { field:"request_date", headerName:"요청일", width:120 },
  { field:"split_count", headerName:"Split수", width:90, type:"numericColumn" },
];

/* ─── 데모 Enable Lab 툴 ─── */
const DEMO_TOOLS = [
  { id:"tool_cd_trend", name:"CD Trend Viewer", author:"김민수", icon:"📈", desc:"Split별 CD 트렌드를 시각화합니다", category:"Inline", shared:true, installed:true },
  { id:"tool_depth_map", name:"Depth Heatmap", author:"이지은", icon:"🗺️", desc:"웨이퍼별 Depth 분포를 히트맵으로 표시", category:"Inline", shared:true, installed:true },
  { id:"tool_profile_3d", name:"3D Profile Viewer", author:"박준혁", icon:"🧊", desc:"Etch Profile을 3D로 렌더링", category:"EPM", shared:true, installed:false },
  { id:"tool_selectivity", name:"Selectivity Calculator", author:"최유리", icon:"⚗️", desc:"Layer별 식각 선택비 자동 계산", category:"Inline", shared:true, installed:false },
  { id:"tool_particle", name:"Particle Map", author:"김민수", icon:"🔬", desc:"웨이퍼 파티클 분포 맵", category:"WT", shared:false, installed:false },
];

/* ─── 파일 첨부 영역 ─── */
function AttachmentSection({ files, onAdd, onRemove }) {
  const inputRef = useRef(null);
  return (
    <div className="bg-white border border-amber-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📎</span>
          <h4 className="text-sm font-bold text-gray-700">실험 산출물</h4>
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">파일 · 이미지</span>
        </div>
        <button onClick={()=>inputRef.current?.click()} className="text-xs px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition font-medium border border-amber-200">
          + 파일 추가
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e=>{if(e.target.files.length) onAdd([...e.target.files]); e.target.value="";}} />
      </div>
      {files.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg py-8 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition" onClick={()=>inputRef.current?.click()}>
          <div className="text-3xl mb-2 opacity-40">📁</div>
          <p className="text-xs text-gray-400">파일을 드래그하거나 클릭하여 업로드</p>
          <p className="text-[10px] text-gray-300 mt-1">가공이 복잡한 데이터, 스크린샷, 보고서 등</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {files.map((f,i) => (
            <div key={i} className="group relative flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 hover:border-amber-200 transition">
              <span className="text-lg flex-shrink-0">{f.type?.startsWith("image/")?"🖼️":f.type?.includes("pdf")?"📄":f.type?.includes("sheet")||f.type?.includes("excel")?"📊":"📎"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                <p className="text-[10px] text-gray-400">{(f.size/1024).toFixed(1)} KB</p>
              </div>
              <button onClick={()=>onRemove(i)} className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition text-[10px]">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Enable Lab 툴 패널 ─── */
function ToolPanel({ tools, onToggleInstall }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const categories = ["all", ...new Set(tools.map(t=>t.category))];
  const filtered = tools.filter(t => {
    if (filter !== "all" && t.category !== filter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const installed = filtered.filter(t=>t.installed);
  const available = filtered.filter(t=>!t.installed);

  return (
    <div className="bg-white border border-indigo-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔧</span>
          <h4 className="text-sm font-bold text-gray-700">Enable Lab 툴</h4>
          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">데이터 시각화</span>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="툴 검색..." className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          <a href="#" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Enable Lab →</a>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-1.5 mb-4">
        {categories.map(c => (
          <button key={c} onClick={()=>setFilter(c)} className={`text-[11px] px-2.5 py-1 rounded-full transition font-medium ${filter===c?"bg-indigo-600 text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            {c === "all" ? "전체" : c}
          </button>
        ))}
      </div>

      {/* 설치된 툴 */}
      {installed.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-gray-400 font-semibold mb-2 uppercase tracking-wider">사용 중 ({installed.length})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {installed.map(tool => (
              <div key={tool.id} className="flex items-start gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl hover:shadow-sm transition group">
                <span className="text-2xl mt-0.5">{tool.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-800">{tool.name}</p>
                    {tool.shared && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">공유</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">{tool.desc}</p>
                  <p className="text-[10px] text-gray-400 mt-1">by {tool.author}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">실행</button>
                  <button onClick={()=>onToggleInstall(tool.id)} className="text-[10px] text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100">제거</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 설치 가능한 툴 */}
      {available.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-400 font-semibold mb-2 uppercase tracking-wider">사용 가능한 툴 ({available.length})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {available.map(tool => (
              <div key={tool.id} className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition">
                <span className="text-2xl mt-0.5 opacity-60">{tool.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-600">{tool.name}</p>
                    {tool.shared && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">공유</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{tool.desc}</p>
                  <p className="text-[10px] text-gray-400 mt-1">by {tool.author}</p>
                </div>
                <button onClick={()=>onToggleInstall(tool.id)} className="text-xs px-3 py-1 bg-white border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium shrink-0 mt-1">+ 추가</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 실험 상세 (Split + Checklist + 첨부 + 툴) ─── */
function ExperimentDetail({ experiment }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checklistRows, setChecklistRows] = useState([{...emptyChecklistRow}]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [tools, setTools] = useState(DEMO_TOOLS.map(t=>({...t})));
  const checklistGridRef = useRef(null);

  useEffect(() => {
    if (!experiment) return;
    setLoading(true);
    setChecklistRows([{...emptyChecklistRow}]);
    setAttachedFiles([]);
    axios.get(`/api/experiments/${experiment.id}`)
      .then(res => setDetail(res.data))
      .catch(err => console.error("실험 상세 로드 실패:", err))
      .finally(() => setLoading(false));
  }, [experiment]);

  const handleToggleInstall = (toolId) => {
    setTools(prev => prev.map(t => t.id === toolId ? {...t, installed: !t.installed} : t));
  };

  if (loading) return <div className="text-center text-gray-400 py-8">로딩 중...</div>;
  if (!detail) return null;

  return (
    <div className="mt-5 border-t border-gray-200 pt-5 space-y-5">
      <h3 className="text-base font-bold text-gray-800">
        {detail.plan_id || "N/A"} — 실험 상세
      </h3>

      {/* 1. Split Table (고정) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-bold text-gray-700">📋 Split Table</h4>
          <span className="text-xs text-gray-400">(plan_id: {detail.plan_id || "N/A"})</span>
        </div>
        {detail.splits?.length > 0 ? (
          <EditableSplitTable splits={detail.splits} planId={detail.plan_id} experimentId={detail.id} onSaved={()=>{}} />
        ) : (
          <p className="text-gray-400 text-sm py-4 text-center">등록된 Split 데이터가 없습니다.</p>
        )}
      </div>

      {/* 2. Checklist (고정) */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <h4 className="text-sm font-bold text-gray-700">실험 Checklist</h4>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">스펙 관리</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={()=>{
              const sel=checklistGridRef.current?.api?.getSelectedNodes();
              if(sel?.length){const updated=checklistRows.filter((_,i)=>!sel.some(n=>n.rowIndex===i));setChecklistRows(updated.length?updated:[{...emptyChecklistRow}]);}
            }} className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition">− 삭제</button>
            <button onClick={()=>setChecklistRows(prev=>[...prev,{...emptyChecklistRow}])} className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition">+ 행 추가</button>
          </div>
        </div>
        <div className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-100" style={{height:Math.min(checklistRows.length*36+42,320)}}>
          <AgGridReact ref={checklistGridRef} rowData={checklistRows} columnDefs={checklistColDefs}
            defaultColDef={{resizable:true,suppressMovable:true}} rowSelection="multiple" headerHeight={36} rowHeight={36} stopEditingWhenCellsLoseFocus
            onCellValueChanged={e=>{const u=[];e.api.forEachNode(n=>u.push(n.data));setChecklistRows(u);}} />
        </div>
      </div>

      {/* 3. 파일 첨부 (안전망) */}
      <AttachmentSection files={attachedFiles} onAdd={newFiles=>setAttachedFiles(prev=>[...prev,...newFiles])} onRemove={idx=>setAttachedFiles(prev=>prev.filter((_,i)=>i!==idx))} />

      {/* 4. Enable Lab 툴 */}
      <ToolPanel tools={tools} onToggleInstall={handleToggleInstall} />
    </div>
  );
}

/* ─── 메인 컴포넌트 ─── */
export default function ExperimentHub() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const gridRef = useRef(null);

  useEffect(() => {
    axios.get("/api/projects")
      .then(res => {
        const sorted = [...res.data].sort((a,b) => {
          const aL = a.experiment_count>0&&a.split_count>0?1:0;
          const bL = b.experiment_count>0&&b.split_count>0?1:0;
          if(bL!==aL) return bL-aL;
          return b.experiment_count-a.experiment_count;
        });
        setProjects(sorted);
      })
      .catch(err => console.error("과제 목록 로드 실패:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProject) { setExperiments([]); setSelectedExperiment(null); return; }
    axios.get(`/api/experiments?iacpj_nm=${encodeURIComponent(selectedProject.iacpj_nm)}`)
      .then(res => setExperiments(res.data))
      .catch(err => console.error("실험 목록 로드 실패:", err));
    setSelectedExperiment(null);
  }, [selectedProject]);

  const filteredProjects = useMemo(() => {
    if (!searchText.trim()) return projects;
    const l = searchText.toLowerCase();
    return projects.filter(p => p.iacpj_nm.toLowerCase().includes(l));
  }, [projects, searchText]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-lg">로딩 중...</div>;

  /* 과제 미선택 */
  if (!selectedProject) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">실험 허브</h2>
              <span className="text-[10px] px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full font-semibold tracking-wide">NEW CONCEPT</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">메타정보(DB) · 고정 뷰(Split/Checklist) · 산출물 첨부 · Enable Lab 툴 연동</p>
          </div>
          <div className="relative w-64">
            <input type="text" value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="과제명 검색..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition" />
            {searchText && <button onClick={()=>setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>}
          </div>
        </div>
        {/* 컨셉 안내 카드 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {icon:"🗄️",title:"메타정보 (DB)",desc:"실험 의도·과제 연계·디바이스 정보",color:"bg-slate-50 border-slate-200"},
            {icon:"📋",title:"고정 뷰",desc:"Split Table + Checklist",color:"bg-emerald-50 border-emerald-200"},
            {icon:"📎",title:"산출물 첨부",desc:"파일·이미지 직접 적재 (안전망)",color:"bg-amber-50 border-amber-200"},
            {icon:"🔧",title:"Enable Lab 툴",desc:"내가 원하는 방식으로 데이터 시각화",color:"bg-indigo-50 border-indigo-200"},
          ].map(c=>(
            <div key={c.title} className={`${c.color} border rounded-xl px-4 py-3`}>
              <span className="text-xl">{c.icon}</span>
              <p className="text-xs font-bold text-gray-700 mt-1.5">{c.title}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} selected={false}
              onClick={()=>setSelectedProject(project)} onDelete={()=>{}} />
          ))}
          {filteredProjects.length===0 && <p className="text-gray-400 text-sm col-span-4 text-center py-10">{searchText?"검색 결과가 없습니다.":"등록된 과제가 없습니다."}</p>}
        </div>
      </div>
    );
  }

  /* 과제 선택됨 */
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={()=>setSelectedProject(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition" title="과제 목록으로">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{selectedProject.iacpj_nm}</h1>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            {selectedProject.iacpj_mod_n && <span>모듈: {selectedProject.iacpj_mod_n}</span>}
            {selectedProject.iacpj_ch_n && <span>PM: {selectedProject.iacpj_ch_n}</span>}
          </div>
        </div>
      </div>

      {/* 실험 목록 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <h3 className="text-base font-semibold text-gray-800">
            실험 목록 <span className="text-sm text-gray-400 font-normal ml-2">({experiments.length}건)</span>
          </h3>
          {selectedExperiment && (
            <button onClick={()=>setSelectedExperiment(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5">선택 해제</button>
          )}
        </div>
        <div className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200" style={{height:320}}>
          <AgGridReact ref={gridRef} rowData={experiments} columnDefs={expColDefs}
            defaultColDef={{sortable:true,resizable:true,filter:true}} rowSelection="single"
            onRowClicked={e=>{if(selectedExperiment?.id===e.data.id){setSelectedExperiment(null);gridRef.current?.api?.deselectAll();}else setSelectedExperiment(e.data);}}
            getRowStyle={p=>p.data?.id===selectedExperiment?.id?{background:"#EEF2FF"}:{}}
            noRowsOverlayComponent={()=><span className="text-gray-400 text-sm">이 과제에 등록된 실험이 없습니다.</span>}
            headerHeight={36} rowHeight={36} suppressMovableColumns animateRows />
        </div>
        {selectedExperiment && <ExperimentDetail experiment={selectedExperiment} />}
      </div>
    </div>
  );
}
