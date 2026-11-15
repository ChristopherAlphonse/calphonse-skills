#!/usr/bin/env python3
"""Tool-call guard for Kiro, Claude Code and OpenCode: enforce the factory policy where each harness's own prompts can be skipped.

A permission mode that approves every `ask` (Kiro `--trust-all-tools`, Claude Code bypass mode) or a rule that cannot
say "everything except" leaves gaps. A hook still runs. Exit 2 blocks the call, so this script fails closed:
anything it cannot read, parse, or match is blocked.

  guard RULES.json   reads the hook event as JSON on stdin: {tool_name, tool_input, cwd}
"""
import json, os, re, sys

SHELL_TOOLS = {"execute_bash", "Bash", "bash"}
WRITE_TOOLS = {"fs_write", "fs_append", "str_replace", "delete_file",  # Kiro
               "Write", "Edit", "MultiEdit", "NotebookEdit",  # Claude Code
               "write", "edit", "multiedit", "patch"}  # OpenCode
PATH_KEYS = ("path", "file_path", "filePath", "notebook_path")
PATCH_FILE = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", re.M)
FD_DUP = re.compile(r"\d*>&\d+-?")  # `2>&1` is not a second command
SPLIT = re.compile(r"&&|\|\||[;|&\n`(){}]|\$\(")
REDIRECT = re.compile(r""">>?\s*("[^"]*"|'[^']*'|[^\s;&|<>()]+)""")


def block(why):
    print(f"blocked by the factory policy: {why}. Run it yourself in a terminal if you mean it.", file=sys.stderr)
    sys.exit(2)


def shell_glob(pattern):
    return re.compile("".join(".*" if c == "*" else re.escape(c) for c in pattern), re.S)


def path_glob(pattern):
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out, i = out + "(?:.*/)?", i + 3
        elif pattern.startswith("**", i):
            out, i = out + ".*", i + 2
        elif pattern[i] == "*":
            out, i = out + "[^/]*", i + 1
        else:
            out, i = out + re.escape(pattern[i]), i + 1
    return re.compile(out + r"\Z")


def any_match(patterns, text, compile_):
    return any(compile_(p).match(text) for p in patterns)


def check_write(rules, cwd, raw):
    path = os.path.realpath(os.path.join(cwd, os.path.expanduser(raw)))
    if any_match(rules["no_write"], path, path_glob):
        block(f"writing {path}")
    if rules["write_only"] and not any_match(rules["write_only"], path, path_glob):
        block(f"writing {path}, which is outside the places this agent may write")


def check_writes(rules, cwd, args):
    paths = [args[k] for k in PATH_KEYS if isinstance(args.get(k), str)]
    if "patchText" in args:  # OpenCode's patch tool names its files inside the patch
        paths += PATCH_FILE.findall(args["patchText"])
    if not paths:
        block("a write whose target file it cannot see")
    for raw in paths:
        check_write(rules, cwd, raw)


def check_shell(rules, cwd, command):
    segments = [s.strip() for s in SPLIT.split(FD_DUP.sub("", command)) if s.strip()]
    if not segments:
        block("an empty command")
    for text in [command.strip(), *segments]:
        if any_match(rules["deny"], text, shell_glob):
            block(f"`{text}` is denied")
        if any_match(rules["ask"], text, shell_glob):
            block(f"`{text}` needs a human")
    for s in segments:
        if not any_match(rules["allow"], s, shell_glob):
            block(f"`{s}` is not on the allow list")
    for target in REDIRECT.findall(command):
        target = target.strip("\"'")
        if "$" in target:  # the shell expands it, so the path cannot be checked here
            block(f"a redirect to {target}, which the guard cannot resolve")
        if target not in ("/dev/null", "&1", "&2"):
            check_write(rules, cwd, target)


def main():
    with open(sys.argv[1]) as f:
        rules = json.load(f)
    event = json.load(sys.stdin)
    tool, args, cwd = event["tool_name"], event["tool_input"], event.get("cwd") or os.getcwd()
    if tool in WRITE_TOOLS:
        check_writes(rules, cwd, args)
    elif tool in SHELL_TOOLS:
        check_shell(rules, cwd, args["command"])


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException as e:  # a crash must not read as "allowed"
        block(f"the guard could not read this call ({type(e).__name__})")
