# -*- coding: utf-8 -*-
"""同步腾讯文档《2027秋招fighting》投递记录 -> data.json
正确解析 field_values 结构。独立可运行，自动化也可调用。
"""
import subprocess, json, datetime, sys, os

TDOC_DIR = r"D:\workbuddy下载\resources\app.asar.unpacked\resources\builtin-plugins\tencent-docs-plugin\skills\tencent-docs"
PYTHON = r"C:\Users\BANG\.workbuddy\binaries\python\versions\3.13.12\python.exe"
WORKBENCH = r"C:\Users\BANG\WorkBuddy\2026-07-27-23-18-33\workbench"
FILE_ID = "fCxyUpZDYzOw"
SHEET_ID = "t00i2h"
DOC_URL = "https://docs.qq.com/smartsheet/DZkN4eVVwWkRZek93"

def run_tdoc(args):
    cmd = [PYTHON, "tencentdocs.py"] + args
    r = subprocess.run(cmd, cwd=TDOC_DIR, capture_output=True, text=True, encoding='utf-8')
    return r.stdout, r.stderr

def tdoc_call(tool, params):
    out, err = run_tdoc(["tdoc_call", "tencent-docs", tool, json.dumps(params, ensure_ascii=False)])
    try:
        d = json.loads(out)
        return d.get('result', {}).get('structuredContent', {})
    except Exception as e:
        print("parse error:", e, out[:300])
        return {}

def extract_value(fv):
    """从 field_value 提取实际内容"""
    if 'text_value' in fv:
        items = fv['text_value'].get('items', [])
        return items[0]['text'] if items else ''
    if 'string_value' in fv:
        return fv['string_value']
    if 'option_value' in fv:
        items = fv['option_value'].get('items', [])
        return items[0]['text'] if items else ''
    if 'url_value' in fv:
        items = fv['url_value'].get('items', [])
        return items[0].get('link', '') if items else ''
    return ''

def todate(v):
    if not v: return ''
    try:
        return datetime.datetime.fromtimestamp(int(v)/1000, tz=datetime.timezone(datetime.timedelta(hours=8))).strftime('%Y-%m-%d')
    except: return ''

def main():
    out, _ = run_tdoc(["tdoc_init"])
    if 'READY' not in out:
        print("TOKEN_NOT_READY skip")
        return
    data = tdoc_call("smartsheet.list_records", {"file_id": FILE_ID, "sheet_id": SHEET_ID})
    recs = data.get('records', [])
    records = []
    for r in recs:
        fvs = r.get('field_values', [])
        f = {}
        for fv in fvs:
            f[fv.get('field', '')] = extract_value(fv)
        rec = {
            'company': f.get('投递公司', '') or '',
            'position': f.get('岗位名称', '') or '',
            'status': f.get('最新状态', '') or '意向投递',
            'date': todate(f.get('投递时间 2', '') or f.get('投递时间', '')),
            'note': f.get('备注', '') or '',
            'link': f.get('投递链接', '') or ''
        }
        if rec['company'] or rec['position']:
            records.append(rec)
    obj = {
        'source': '腾讯文档·2027秋招fighting',
        'docUrl': DOC_URL,
        'syncedAt': datetime.datetime.now().isoformat(timespec='seconds'),
        'records': records
    }
    path = os.path.join(WORKBENCH, 'data.json')
    with open(path, 'w', encoding='utf-8') as fp:
        json.dump(obj, fp, ensure_ascii=False, indent=2)
    # 统计
    from collections import Counter
    c = Counter(r['status'] for r in records)
    print(f"OK {len(records)} records -> {path}")
    print("状态分布:", dict(c))

if __name__ == '__main__':
    main()
