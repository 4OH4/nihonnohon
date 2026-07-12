import sys, io, json, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
path = os.path.join(os.environ["TEMP"], "proto_out.json")
with open(path, encoding="utf-8") as f:
    lines = f.read()
for line in lines.splitlines():
    if line.startswith("Step"):
        print(line)
start = lines.index("[")
data = json.loads(lines[start:])
for s in data:
    print()
    print(s["english"])
    print("Words:", " | ".join(s["words"]))
    for v in s["vocab"]:
        pos = v.get("pos", "")
        gloss = v.get("gloss", "")
        src = f"[{v['gloss_source']}]" if "gloss_source" in v else ""
        surface = v["surface"]
        df = v["dictionary_form"]
        print(f"  {pos:8} {surface:18} {df:14} {src:8} {gloss}")
