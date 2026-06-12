#!/usr/bin/env python3
"""把多文件工程打包为自包含单文件（AirDrop / 本地双击专用）
用法：python3 build_single.py  → 生成 dist/sanguo-single.html"""
import re, os, pathlib

root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')

# 内联 CSS
def inline_css(m):
    href = m.group(1).split('?')[0]
    css = (root / href).read_text(encoding='utf-8')
    return '<style>\n' + css + '\n</style>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)

# 内联 JS
def inline_js(m):
    src = m.group(1).split('?')[0]
    js = (root / src).read_text(encoding='utf-8')
    return '<script>\n' + js + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

# 移除仅线上有意义的引用（本地 file:// 下 404 无害，但干脆去掉）
html = html.replace('<link rel="manifest" href="manifest.json">\n', '')
html = html.replace('<link rel="apple-touch-icon" href="icon.png">\n', '')

out = root / 'dist'
out.mkdir(exist_ok=True)
(out / 'sanguo-single.html').write_text(html, encoding='utf-8')
print('OK →', out / 'sanguo-single.html', f'({len(html)//1024} KB)')
