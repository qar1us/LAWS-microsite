import openpyxl, os, json, collections, re
_TIERS=("Unknown","Contested","Low Confidence","Moderate Confidence","High-Confidence","Confirmed")
def _conf(v):
    if not v: return None
    v=str(v).strip()
    if v in _TIERS: return v
    hits=[t for t in _TIERS if t.lower() in v.lower()]
    return hits[0] if hits else v   # most conservative tier mentioned
P=os.path.expanduser
wb=openpyxl.load_workbook(P("~/LAWS-microsite/Data/LAWS_Dataset_V1.xlsx"), data_only=True)

def sheet(name):
    rows=list(wb[name].iter_rows(values_only=True))
    hdr=[str(h).strip() if h else None for h in rows[0]]
    out=[]
    for r in rows[1:]:
        if all(v is None for v in r): continue
        d={h:(str(v).strip() if isinstance(v,str) else v) for h,v in zip(hdr,r) if h}
        out.append(d)
    return out

systems=sheet("Systems")
purposes=sheet("Purposes"); funcs=sheet("Autonomy_Functions")
ops=sheet("Operators"); srcsys=sheet("Source_by_System"); srcph=sheet("Source_Photos")
annex=sheet("Annex_Excluded")

by_purpose=collections.defaultdict(list)
for r in purposes:
    if r.get("System ID") and r.get("Operational Purpose"): by_purpose[r["System ID"]].append(r["Operational Purpose"])
by_func=collections.defaultdict(dict)
for r in funcs:
    if r.get("System ID") and r.get("Autonomous Function"): by_func[r["System ID"]][r["Autonomous Function"]]=r.get("Autonomy Level")
by_op=collections.defaultdict(list)
for r in ops:
    if r.get("System ID"): by_op[r["System ID"]].append({k:v for k,v in r.items() if k!="System ID" and v})
by_src={r["System ID"]:{k:v for k,v in r.items() if k not in("System ID","System Name") and v} for r in srcsys if r.get("System ID")}

credits=json.load(open(P("~/LAWS-microsite/img/credits.json")))["images"]
imgs=collections.defaultdict(list)
for f,m in sorted(credits.items()):
    if m["systemId"]: imgs[m["systemId"]].append({"file":f,"slot":m["slot"],"status":m["status"],
        "category":m["category"],"sourceUrl":m["sourceUrl"],"sourceDomain":m["sourceDomain"]})


_NOCOMBAT = re.compile(r"^\s*(none|no\s+(confirmed|public|known|recorded)|not\s+(yet\s+)?(used|employed|confirmed)|unknown|n/?a)\b", re.I)
def _combat(v):
    """True when the Confirmed Effects field records actual employment."""
    return bool(v) and not _NOCOMBAT.match(str(v))

FUNC_ORDER=["Mission Planning","Navigation","Route Preplanning","Search","Sensor Management","Detection",
"Tracking","Classification","Identification","Target Nomination","Target Prioritization","Target Selection",
"Engagement Decision","Weapon Release","Terminal Guidance","Battle-Damage Assessment","Reattack",
"Coordination with Other Systems","Swarm Coordination and Execution"]

out=[]
for s in systems:
    sid=s.get("System ID")
    if not sid: continue
    tier=(s.get("Inclusion Basis") or "").strip()
    out.append({
      "id":sid,"name":s.get("System Name"),"family":s.get("System Family"),"variant":s.get("Variant"),
      "manufacturer":s.get("Manufacturer"),"developer":s.get("Developer"),"origin":s.get("Country of Origin"),
      "domain":s.get("Warfighting Domain"),"reuse":s.get("Reusable / Expendable"),"effect":s.get("Effect Type"),
      "tier":(re.search(r'\b(A1|A2|A3|B1)\b',tier).group(1) if re.search(r'\b(A1|A2|A3|B1)\b',tier) else None),
      "tierFull":tier,"tierCaveat":(tier if tier and not re.fullmatch(r'(A1|A2|A3|B1)\.?.*',tier.strip()) else None),
      "auth":s.get("Autonomous Mode Authorization"),"supervision":s.get("Supervisory Control"),
      "envelope":s.get("Engagement Envelope"),"devStatus":s.get("Development Status"),
      "fieldStatus":s.get("Fielding Status"),"ocDate":s.get("Operational Capability Date"),
      "theater":s.get("Deployment Theater"),"targets":s.get("Target Type Engaged"),
      "effects":s.get("Confirmed Effects"),
      "confidence":_conf(s.get("Overall Confidence")),"confidenceRaw":s.get("Overall Confidence"),
      "notes":s.get("Analyst Notes"),
      "purposes":by_purpose.get(sid,[]),"operators":by_op.get(sid,[]),
      "functions":by_func.get(sid,{}),"sources":by_src.get(sid,{}),"images":imgs.get(sid,[]),
    })

data={"generated":"from LAWS_Dataset_V1.xlsx","functionOrder":FUNC_ORDER,
      "systems":out,"excluded":annex,
      "counts":{"systems":len(out),
                "operatorCountries":len({o.get("Operator Country") for v in by_op.values() for o in v if o.get("Operator Country")}),
                "withCombatEvidence":sum(1 for s in out if _combat(s["effects"])),
                "byDomain":dict(collections.Counter(s["domain"] for s in out)),
                "byTier":dict(collections.Counter(s["tier"] for s in out)),
                "originCountries":len({s["origin"] for s in out if s["origin"]})}}
open(P("~/LAWS-microsite/data.json"),"w").write(json.dumps(data,indent=1,ensure_ascii=False)+"\n")
print("data.json:", os.path.getsize(P("~/LAWS-microsite/data.json"))//1024, "KB")
print("systems:",len(out))
for k in ("domain","tier","confidence","fieldStatus","origin"):
    c=collections.Counter(s[k] for s in out)
    print(f"\n{k}: "+", ".join(f"{v}={n}" for v,n in c.most_common(12)))
