# -*- coding: utf-8 -*-
"""同步腾讯文档《招聘信息汇总表》最新日期的招聘信息 -> jobs.json
用法: python sync_jobs.py
独立可运行，自动化也可调用。
"""
import subprocess, json, csv, io, datetime, sys, os, re

TDOC_DIR = r"D:\workbuddy下载\resources\app.asar.unpacked\resources\builtin-plugins\tencent-docs-plugin\skills\tencent-docs"
PYTHON = r"C:\Users\BANG\.workbuddy\binaries\python\versions\3.13.12\python.exe"
WORKBENCH = r"C:\Users\BANG\WorkBuddy\2026-07-27-23-18-33\workbench"
FILE_ID = "bdQXKhQvhdoq"   # 招聘信息汇总表
SHEET_ID = "000001"        # 1-26-27届校招汇总
DOC_URL = "https://docs.qq.com/sheet/DYmRRWEtoUXZoZG9x"

FIELDS = ["date","company","type","industry","position","city",
          "major","deadline","session","edu","category","link","apply"]

def run_tdoc(args):
    cmd = [PYTHON, "tencentdocs.py"] + args
    r = subprocess.run(cmd, cwd=TDOC_DIR, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return r.stdout, r.stderr

def tdoc_call(tool, params):
    out, err = run_tdoc(["tdoc_call", "tencent-docs", tool, json.dumps(params, ensure_ascii=False)])
    try:
        d = json.loads(out)
        return d.get('result', {}).get('structuredContent', {})
    except Exception as e:
        print("parse error:", e, out[:300])
        return {}

def parse_date(s):
    s = (s or "").strip()
    for fmt in ("%Y/%m/%d","%Y-%m-%d","%Y/%m/%d %H:%M","%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except: pass
    # 尝试提取 yyyy/m/d
    m = re.search(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', s)
    if m:
        try:
            return datetime.datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except: pass
    return None

def main():
    # 1. 检查票据
    out, _ = run_tdoc(["tdoc_init"])
    if not out or 'READY' not in out:
        print("TOKEN_NOT_READY skip")
        return
    # 2. 读前 150 行（最新日期记录在表头之后、按降序排列）
    data = tdoc_call("sheet.get_cell_data", {
        "file_id": FILE_ID, "sheet_id": SHEET_ID,
        "start_row": 1, "end_row": 150,
        "start_col": 0, "end_col": 12, "return_csv": True
    })
    csv_text = data.get("csv_data", "")
    if not csv_text:
        print("NO_DATA")
        return
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    # 3. 按日期分组
    from collections import defaultdict
    groups = defaultdict(list)
    for row in rows:
        if len(row) < 13: continue
        d = row[0].strip()
        if d: groups[d].append(row)
    # 4. 找最新日期
    valid = [(d, parse_date(d)) for d in groups if parse_date(d)]
    if not valid:
        print("NO_VALID_DATE")
        return
    latest_date = max(valid, key=lambda x: x[1])[0]
    latest_rows = groups[latest_date]
    # 5. 组装
    jobs = []
    for r in latest_rows:
        rec = {}
        for i, f in enumerate(FIELDS):
            rec[f] = r[i] if i < len(r) else ""
        jobs.append(rec)
    out_obj = {
        "source": "腾讯文档·招聘信息汇总表",
        "docUrl": DOC_URL,
        "syncedAt": datetime.datetime.now().isoformat(timespec='seconds'),
        "latestDate": latest_date,
        "count": len(jobs),
        "jobs": jobs
    }
    path = os.path.join(WORKBENCH, "jobs.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out_obj, f, ensure_ascii=False, indent=2)
    print(f"OK {len(jobs)} jobs on {latest_date} -> {path}")

if __name__ == "__main__":
    main()
