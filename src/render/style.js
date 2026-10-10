export const STYLE = `
:root{
  --bg:#f5f7f9; --surface:#fff; --surface-2:#eef1f5;
  --ink:#1a2230; --ink-muted:#5c6779; --ink-faint:#8b95a5; --line:#dde2e9; --accent:#3956b8; --accent-bg:#e8ebf9;
  --done:#0b8f80; --done-bg:#e3f4f0; --wip:#b8730a; --wip-bg:#faf0dd; --backlog:#4a5fb0; --backlog-bg:#eaedf9;
  --shadow:0 1px 2px rgba(20,30,50,.04),0 8px 24px -12px rgba(20,30,50,.10);
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#14161b; --surface:#1c1f26; --surface-2:#20242c;
    --ink:#eef1f6; --ink-muted:#a0aabb; --ink-faint:#6b7688; --line:#2c313c; --accent:#8fa0f5; --accent-bg:#232a4a;
    --done:#20a896; --done-bg:#153631; --wip:#c07e1e; --wip-bg:#3a2c14; --backlog:#6c82e0; --backlog-bg:#232a4a;
    --shadow:0 1px 2px rgba(0,0,0,.3),0 12px 32px -16px rgba(0,0,0,.5);
  }
}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Vazirmatn',Tahoma,sans-serif;direction:rtl;text-align:right;line-height:1.55;}
.num{font-family:'JetBrains Mono','Vazirmatn',monospace;font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate;}
.page{max-width:960px;margin:0 auto;padding:40px 28px 64px;display:flex;flex-direction:column;gap:28px;}
header{display:flex;flex-direction:column;gap:6px;padding-bottom:18px;border-bottom:1px solid var(--line);}
.eyebrow{font-family:'JetBrains Mono',monospace;direction:ltr;text-align:right;font-size:12px;letter-spacing:.08em;color:var(--accent);font-weight:600;text-transform:uppercase;}
h1{margin:0;font-size:28px;font-weight:800;}
.subtitle{color:var(--ink-muted);font-size:14px;margin:0;}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px;}
.stat-top{display:flex;align-items:center;justify-content:space-between;}
.stat-label{font-size:13px;font-weight:600;color:var(--ink-muted);}
.dot{width:9px;height:9px;border-radius:50%;flex:none;}
.stat-value{font-size:30px;font-weight:700;line-height:1;}
.stat-sub{font-size:12px;color:var(--ink-faint);}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--ink-muted);align-items:center;}
.legend-item{display:flex;align-items:center;gap:8px;}
.swatch{width:12px;height:12px;border-radius:3px;flex:0 0 12px;display:inline-block;}
.legend-big{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:13.5px;}
.legend-big .swatch{width:14px;height:14px;border-radius:4px;}
section{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px 22px 24px;box-shadow:var(--shadow);}
section>h2{margin:0 0 4px;font-size:15.5px;font-weight:700;}
section>.section-note{margin:0 0 16px;font-size:12.5px;color:var(--ink-muted);}
details.mod-acc{border:1px solid var(--line);border-radius:12px;background:var(--surface);margin-bottom:10px;overflow:hidden;}
details.mod-acc[open]{border-color:var(--ink-faint);}
details.mod-acc>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 16px;}
details.mod-acc>summary::-webkit-details-marker{display:none;}
details.mod-acc>summary::before{content:"";flex:0 0 auto;width:7px;height:7px;border-inline-start:2px solid var(--ink-faint);border-bottom:2px solid var(--ink-faint);transform:rotate(-45deg);transition:transform .15s;}
details.mod-acc[open]>summary::before{transform:rotate(45deg);}
details.mod-acc>summary:hover{background:var(--surface-2);}
.mod-acc-name{font-weight:700;font-size:14.5px;}
.mod-acc-count{font-size:12px;color:var(--ink-muted);}
.mod-acc-chips{display:flex;gap:6px;flex-wrap:wrap;margin-inline-start:auto;}
.mod-acc-body{padding:0 12px 14px;}
.sp-bar{display:flex;height:8px;border-radius:6px;overflow:hidden;background:var(--surface-2);gap:2px;flex:1 1 140px;min-width:120px;}
.sp-bar span{display:block;height:100%;}
.sp-meta{font-size:12px;color:var(--ink-muted);}
.sp-carried{font-size:11.5px;color:var(--wip);margin-inline-start:6px;}
.overall-bar{display:flex;direction:rtl;height:32px;border-radius:8px;overflow:hidden;background:var(--surface-2);gap:2px;}
.overall-bar span{display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:#fff;direction:ltr;white-space:nowrap;overflow:hidden;}
.modules{display:flex;flex-direction:column;gap:14px;}
.module-row{display:grid;grid-template-columns:150px 1fr 104px;align-items:center;gap:12px;}
.module-name{font-size:13px;font-weight:600;}
.module-code{display:block;font-family:'JetBrains Mono',monospace;direction:ltr;text-align:right;font-size:10.5px;color:var(--ink-faint);margin-top:2px;}
.bar-track{display:flex;direction:rtl;height:20px;border-radius:6px;overflow:hidden;background:var(--surface-2);gap:2px;}
.bar-track .seg{height:100%;}
.seg.done{background:var(--done);} .seg.wip{background:var(--wip);} .seg.backlog{background:var(--backlog);}
.module-pct{font-family:'JetBrains Mono',monospace;direction:ltr;text-align:left;font-size:11.5px;color:var(--ink-muted);white-space:nowrap;}
.module-pct b{color:var(--done);font-weight:700;}
.table-wrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th,td{padding:9px 8px;text-align:center;white-space:nowrap;}
th:first-child,td:first-child{text-align:right;}
thead th{color:var(--ink-muted);font-weight:600;font-size:11.5px;border-bottom:1px solid var(--line);}
tbody tr:not(:last-child) td{border-bottom:1px solid var(--line);}
tbody tr.total-row td{border-top:2px solid var(--line);font-weight:700;}
td.num,th.num{font-family:'JetBrains Mono',monospace;}
.pill{display:inline-flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;}
.pill::before{content:"";width:7px;height:7px;border-radius:50%;}
.pill.d::before{background:var(--done);} .pill.w::before{background:var(--wip);} .pill.b::before{background:var(--backlog);}
.verdict{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 9px;border-radius:999px;white-space:nowrap;}
.verdict::before{content:"";width:7px;height:7px;border-radius:50%;flex:none;}
.verdict.go{color:var(--done);background:var(--done-bg);} .verdict.go::before{background:var(--done);}
.verdict.wait{color:var(--wip);background:var(--wip-bg);} .verdict.wait::before{background:var(--wip);}
.verdict.blocked{color:var(--backlog);background:var(--backlog-bg);} .verdict.blocked::before{background:var(--backlog);}
.verdict.fe{color:var(--accent);background:var(--accent-bg);} .verdict.fe::before{background:var(--accent);}
.evidence-table a{color:var(--accent);font-weight:600;text-decoration:none;}
.evidence-table a:hover{text-decoration:underline;}
footer{font-size:11.5px;color:var(--ink-faint);text-align:center;padding-top:6px;display:flex;flex-direction:column;gap:6px;}
footer a{color:var(--ink-faint);}
.login-wrap{max-width:420px;margin:80px auto;display:flex;flex-direction:column;gap:16px;}
.login-wrap h1{font-size:22px;margin:0;}
.login-wrap p{color:var(--ink-muted);font-size:13px;margin:0;}
.field{display:flex;flex-direction:column;gap:6px;font-size:13px;}
.field input{
  font-family:inherit;font-size:14px;padding:10px 12px;border-radius:8px;border:1px solid var(--line);
  background:var(--surface);color:var(--ink);direction:ltr;text-align:left;
}
.field input:focus{outline:2px solid var(--accent);outline-offset:1px;}
button{
  font-family:inherit;font-size:14px;font-weight:600;padding:11px 16px;border-radius:8px;border:none;
  background:var(--accent);color:#fff;cursor:pointer;
}
button:hover{filter:brightness(1.08);}
.error{color:#c0392b;font-size:13px;}
.logout{font-size:12px;color:var(--ink-faint);text-decoration:none;}
.toolbar{display:flex;justify-content:flex-end;gap:10px;}
.toolbar button{background:var(--surface-2);color:var(--ink);border:1px solid var(--line);font-weight:600;font-size:12.5px;padding:7px 14px;}
.toolbar button:hover{filter:none;background:var(--line);}
.delta{font-size:11.5px;font-family:'JetBrains Mono',monospace;direction:ltr;unicode-bidi:isolate;}
.delta.up{color:var(--done);} .delta.down{color:#c0392b;} .delta.flat{color:var(--ink-faint);}
.summary{display:flex;flex-direction:column;gap:9px;font-size:13.5px;line-height:1.9;}
.summary li{margin-inline-start:18px;}
.summary b{color:var(--ink);}
.summary .headline{font-size:16px;font-weight:700;margin:0;}
@media (max-width:640px){.stats{grid-template-columns:1fr;} .module-row{grid-template-columns:1fr;gap:6px;} .module-pct{text-align:right;}}
@media print{
  body{background:#fff;}
  .toolbar,.logout,a.logout{display:none!important;}
  section{box-shadow:none;border:1px solid #ccc;break-inside:avoid;}
  .page{max-width:100%;padding:0;}
}
.pick-hint{font-size:12px;color:var(--ink-faint);}
.err-box{border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--surface);}
.err-box pre{white-space:pre-wrap;direction:ltr;text-align:left;font-size:12px;color:var(--ink-muted);margin:8px 0 0;}
.tb-link{font-size:12.5px;color:var(--ink-muted);text-decoration:none;border:1px solid var(--line);border-radius:8px;padding:7px 14px;background:var(--surface-2);}
.tb-link:hover{background:var(--line);}
.toolbar form{margin:0;}
.toolbar{align-items:center;flex-wrap:wrap;}
.who{font-size:12px;color:var(--ink-faint);margin-inline-end:auto;}
.proj-pick{margin:0;}
.proj-pick select{font-family:inherit;font-size:13px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);max-width:320px;cursor:pointer;}
.proj-pick select:focus{outline:2px solid var(--accent);outline-offset:1px;}
.help{margin-top:8px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font-size:12.5px;color:var(--ink-muted);line-height:1.8;}
.help b{color:var(--ink);}
.help ol{margin:6px 0 8px;padding-inline-start:20px;}
.help a{color:var(--accent);}
.roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;}
.role{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--surface);}
.role h3{margin:0 0 8px;font-size:14.5px;}
.role-item{margin:10px 0 4px;font-size:13px;font-weight:600;}
.role-note{margin:10px 0 0;font-size:12.5px;color:var(--ink-muted);}
.role-empty{margin:4px 0 0;font-size:13px;color:var(--ink-muted);}
.task-list{margin:0;padding-inline-start:18px;font-size:12.5px;line-height:1.8;}
.task-list a{color:var(--accent);text-decoration:none;font-weight:600;}
.task-list .more{color:var(--ink-faint);list-style:none;}
`;
