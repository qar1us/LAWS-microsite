import openpyxl, os, json, collections, re
_TIERS=("Unknown","Contested","Low Confidence","Moderate Confidence","High-Confidence","Confirmed")
def _conf(v):
    if not v: return None
    v=str(v).strip()
    # The Aug 2026 workbook writes "High Confidence"; the methodology sheet and the
    # site use "High-Confidence". Normalise so both spellings land on one tier.
    if v.lower()=="high confidence": v="High-Confidence"
    if v in _TIERS: return v
    hits=[t for t in _TIERS if t.lower() in v.lower()]
    return hits[0] if hits else v   # most conservative tier mentioned
import sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKBOOK=sys.argv[1] if len(sys.argv)>1 else os.path.join(ROOT,"Data","LAWS_Tracker_Dataset.xlsx")
wb=openpyxl.load_workbook(WORKBOOK, data_only=True)

def _cell(c):
    v=c.value
    v=v.strip() if isinstance(v,str) else v
    # Source cells show a publisher name and keep the URL as the cell's hyperlink.
    if c.hyperlink and c.hyperlink.target and v: return {"label":v,"url":c.hyperlink.target}
    return v

def sheet(name):
    rows=list(wb[name].iter_rows())
    hdr=[str(c.value).strip() if c.value else None for c in rows[0]]
    out=[]
    for r in rows[1:]:
        if all(c.value is None for c in r): continue
        d={h:_cell(c) for h,c in zip(hdr,r) if h}
        out.append(d)
    return out

def _text(v):
    return v["label"] if isinstance(v,dict) else v

# V.1 review (21 Aug 2026) pulled IND-LAND-001, IRN-LAND-001 and IRN-AIR-001; the
# Aug 2026 workbook drops them at source. Kept as a hook for future review pulls.
EXCLUDE_SYSTEMS = set()
# V.1 review: dropped from the autonomy-by-function matrix as non-differentiating.
EXCLUDE_FUNCTIONS = {"Mission Planning"}

systems=[{k:(v if k.startswith("Effects Source") else _text(v)) for k,v in r.items()}
         for r in sheet("Systems") if r.get("System ID") not in EXCLUDE_SYSTEMS]
desc={r["System ID"]:_text(r.get("Description")) for r in sheet("Descriptions") if r.get("System ID")}
purposes=sheet("Purposes"); funcs=sheet("Autonomy_Functions")
ops=sheet("Operators"); srcsys=sheet("Source_by_System"); srcph=sheet("Source_Photos")
# The annex heading moved from "System / Programme" to "System / Program" between
# workbooks; emit fixed keys so the page does not depend on the spelling.
annex=[{"name":_text(r.get("System / Program") or r.get("System / Programme")),
        "country":_text(r.get("Country")),"category":_text(r.get("Category")),
        "rationale":_text(r.get("Exclusion Rationale"))} for r in sheet("Annex_Excluded")]

by_purpose=collections.defaultdict(list)
for r in purposes:
    if r.get("System ID") and r.get("Operational Purpose"): by_purpose[r["System ID"]].append(r["Operational Purpose"])
by_func=collections.defaultdict(dict)
for r in funcs:
    if r.get("System ID") and r.get("Autonomous Function") and r["Autonomous Function"] not in EXCLUDE_FUNCTIONS:
        by_func[r["System ID"]][r["Autonomous Function"]]=r.get("Autonomy Level")
# Spelling variants in the workbook that name the same state; without this they
# count twice in the operator total. Fix at source too, then this becomes a no-op.
COUNTRY_ALIASES={"S. Korea":"South Korea"}
by_op=collections.defaultdict(list)
for r in ops:
    if r.get("System ID"):
        o={k:_text(v) for k,v in r.items() if k!="System ID" and v}
        if o.get("Operator Country") in COUNTRY_ALIASES: o["Operator Country"]=COUNTRY_ALIASES[o["Operator Country"]]
        by_op[r["System ID"]].append(o)
by_src={r["System ID"]:{k:v for k,v in r.items() if k not in("System ID","System Name") and v} for r in srcsys if r.get("System ID")}

credits=json.load(open(os.path.join(ROOT,"img","credits.json")))["images"]
imgs=collections.defaultdict(list)
for f,m in sorted(credits.items()):
    if m["systemId"]: imgs[m["systemId"]].append({"file":f,"slot":m["slot"],"status":m["status"],
        "category":m["category"],"sourceUrl":m["sourceUrl"],"sourceDomain":m["sourceDomain"]})


# From the Aug 2026 workbook, Confirmed Effects opens with an evidence label:
#   "Combat:"                           corroborated combat use
#   "Combat reported, uncorroborated:"  reported but not independently confirmed
#   "Deployed:"                         operationally deployed, no recorded engagement
#   "Tested:"                           test or demonstration only
# The label is split off into its own field so counts never parse free text.
_EVIDENCE=(("combat reported, uncorroborated","reported"),("combat","combat"),
           ("deployed","deployed"),("tested","tested"))
def _evidence(v):
    """Return (evidence class, effects text without its label)."""
    if not v: return None, None
    v=str(v).strip()
    head,sep,rest=v.partition(":")
    for label,cls in _EVIDENCE:
        if sep and head.strip().lower()==label: return cls, rest.strip()
    return None, v

def _fielded(v):
    """True for any 'Fielded…' status the analyst has not flagged as unconfirmed."""
    v=(v or "").strip().lower()
    return v.startswith("fielded") and "unconfirmed" not in v

FUNC_ORDER=["Navigation","Route Preplanning","Search","Sensor Management","Detection",
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
      "evidence":_evidence(s.get("Confirmed Effects"))[0],
      "effects":_evidence(s.get("Confirmed Effects"))[1],
      "effectsSources":[s[k] for k in ("Effects Source 1","Effects Source 2","Effects Source 3","Effects Source 4") if s.get(k)],
      "description":desc.get(sid),
      "confidence":_conf(s.get("Overall Confidence")),"confidenceRaw":s.get("Overall Confidence"),
      "notes":s.get("Analyst Notes"),
      "purposes":by_purpose.get(sid,[]),"operators":by_op.get(sid,[]),
      "functions":by_func.get(sid,{}),"sources":by_src.get(sid,{}),"images":imgs.get(sid,[]),
    })

data={"generated":"from "+os.path.basename(WORKBOOK),"functionOrder":FUNC_ORDER,
      "systems":out,"excluded":annex,"removed":sorted(EXCLUDE_SYSTEMS),
      "counts":{"systems":len(out),
                "operatorCountries":len({o.get("Operator Country") for v in by_op.values() for o in v if o.get("Operator Country")}),
                "fielded":sum(1 for s in out if _fielded(s["fieldStatus"])),
                "withCombatEvidence":sum(1 for s in out if s["evidence"]=="combat"),
                "withReportedCombat":sum(1 for s in out if s["evidence"]=="reported"),
                "byEvidence":dict(collections.Counter(s["evidence"] for s in out)),
                "byDomain":dict(collections.Counter(s["domain"] for s in out)),
                "byTier":dict(collections.Counter(s["tier"] for s in out)),
                "originCountries":len({s["origin"] for s in out if s["origin"]})}}
open(os.path.join(ROOT,"data.json"),"w").write(json.dumps(data,indent=1,ensure_ascii=False)+"\n")
print("data.json:", os.path.getsize(os.path.join(ROOT,"data.json"))//1024, "KB")
print("systems:",len(out))
unlabelled=[s["id"] for s in out if s["effects"] and not s["evidence"]]
if unlabelled: print("WARNING: effects with no evidence label:", ", ".join(unlabelled))
for k in ("domain","tier","confidence","evidence","origin"):
    c=collections.Counter(s[k] for s in out)
    print(f"\n{k}: "+", ".join(f"{v}={n}" for v,n in c.most_common(12)))
