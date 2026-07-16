import json
import os

transcript_path = r"C:\Users\Dr. Yogesh\.gemini\antigravity\brain\922e378c-7c35-406e-9e6e-ac6480f4cc71\.system_generated\logs\transcript.jsonl"

edits = []
with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        try:
            step = json.loads(line)
            # Look for planner responses containing tool calls
            if step.get("type") == "PLANNER_RESPONSE" and "tool_calls" in step:
                for tool in step["tool_calls"]:
                    name = tool.get("name")
                    if name in ["replace_file_content", "multi_replace_file_content", "write_to_file"]:
                        args = tool.get("args")
                        # Some args might be stringified JSON or dict
                        if isinstance(args, str):
                            try:
                                args = json.loads(args)
                            except:
                                pass
                        
                        edits.append({
                            "step_index": step.get("step_index"),
                            "created_at": step.get("created_at"),
                            "tool": name,
                            "args": args
                        })
        except Exception as e:
            pass

print(f"Total edit tool calls found: {len(edits)}")
# Print the last 15 edit tool calls to see the most recent ones
for edit in edits[-20:]:
    print("-" * 50)
    print(f"Step: {edit['step_index']} | Time: {edit['created_at']} | Tool: {edit['tool']}")
    args = edit["args"]
    if isinstance(args, dict):
        print(f"TargetFile: {args.get('TargetFile')}")
        print(f"Description: {args.get('Description')}")
        if "ReplacementChunks" in args:
            print(f"Chunks Count: {len(args['ReplacementChunks'])}")
    else:
        print(f"Args: {args}")
