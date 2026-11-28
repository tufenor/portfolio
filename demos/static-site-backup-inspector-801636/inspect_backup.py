#!/usr/bin/env python3
"""Inspect a static HTML folder or ZIP without extracting or changing its files."""
from __future__ import annotations
import argparse, html, json, re, zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

MAX_FILES = 2500
MAX_UNCOMPRESSED = 100 * 1024 * 1024
ATTRS = {"a": ("href",), "img": ("src", "srcset"), "script": ("src",), "link": ("href",), "source": ("src", "srcset"), "video": ("src", "poster"), "audio": ("src",), "iframe": ("src",)}

class Refs(HTMLParser):
    def __init__(self): super().__init__(); self.values=[]
    def handle_starttag(self, tag, attrs):
        wanted=ATTRS.get(tag, ())
        for name,value in attrs:
            if name not in wanted or not value: continue
            if name == "srcset":
                self.values.extend(part.strip().split()[0] for part in value.split(",") if part.strip())
            else: self.values.append(value.strip())

def safe_name(raw: str) -> str | None:
    name=raw.replace("\\", "/")
    p=PurePosixPath(name)
    if p.is_absolute() or re.match(r"^[A-Za-z]:", name) or ".." in p.parts: return None
    clean=str(p)
    while clean.startswith("./"): clean=clean[2:]
    return clean

def load_files(path: Path) -> dict[str, bytes]:
    if path.is_dir():
        out={}
        for p in path.rglob("*"):
            if not p.is_file() or p.is_symlink(): continue
            key=p.relative_to(path).as_posix()
            out[key]=p.read_bytes()
            if len(out)>MAX_FILES: raise ValueError(f"Mais de {MAX_FILES} arquivos; análise interrompida.")
        return out
    if not zipfile.is_zipfile(path): raise ValueError("Forneça uma pasta de site ou arquivo ZIP válido.")
    out={}; total=0
    with zipfile.ZipFile(path) as z:
        infos=[i for i in z.infolist() if not i.is_dir()]
        if len(infos)>MAX_FILES: raise ValueError(f"ZIP contém mais de {MAX_FILES} arquivos.")
        for info in infos:
            key=safe_name(info.filename)
            if key is None: raise ValueError(f"Caminho absoluto ou traversal encontrado: {info.filename}")
            total+=info.file_size
            if total>MAX_UNCOMPRESSED: raise ValueError("Tamanho descompactado excede 100 MB.")
            out[key]=z.read(info)
    return out

def target_for(page: str, raw: str) -> str | None:
    if raw.startswith(("#", "//")): return None
    parsed=urlsplit(raw)
    if parsed.scheme or parsed.netloc: return None
    path=unquote(parsed.path)
    if not path: return None
    if path.startswith("/"): target=PurePosixPath(path.lstrip("/"))
    else: target=PurePosixPath(page).parent / path
    normalized=[]
    for part in target.parts:
        if part in ("", "."): continue
        if part=="..":
            if not normalized: return None
            normalized.pop()
        else: normalized.append(part)
    result="/".join(normalized)
    if result.endswith("/"): result+="index.html"
    return result

def inspect(files: dict[str,bytes]) -> dict:
    names=set(files); pages=sorted(n for n in names if n.lower().endswith((".html",".htm")))
    missing=[]; inspected=0
    for css in sorted(n for n in names if n.lower().endswith(".css")):
        content=files[css].decode("utf-8",errors="replace")
        for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", content, flags=re.I):
            ref=match.group(2).strip()
            target=target_for(css,ref)
            if target and target not in names: missing.append({"page":css,"reference":ref,"expected":target})
    for page in pages:
        parser=Refs()
        try: parser.feed(files[page].decode("utf-8",errors="replace"))
        except Exception: continue
        for ref in parser.values:
            target=target_for(page,ref)
            if target and target not in names:
                missing.append({"page":page,"reference":ref,"expected":target})
        inspected+=1
    return {"html_pages":inspected,"files":len(names),"missing_references":missing,"ok":bool(names) and not missing,"root_index_present":"index.html" in names}

def main():
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("site",type=Path,help="Pasta estática ou ZIP de backup"); ap.add_argument("--output",type=Path,help="Salvar relatório JSON"); args=ap.parse_args()
    result=inspect(load_files(args.site))
    text=json.dumps(result,ensure_ascii=False,indent=2)
    if args.output: args.output.write_text(text+"\n",encoding="utf-8")
    print(text)
    return 0 if result["ok"] and result["root_index_present"] else 1
if __name__=="__main__": raise SystemExit(main())

