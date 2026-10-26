"""Use the packaged DOCX rasterizer with the available Windows document engine.

The native Word-compatible exporter creates an adjacent .pdf before this runs.
Only the unavailable LibreOffice conversion step is substituted; the packaged
render_docx.py still computes DPI and rasterizes every page with bundled Poppler.
"""
import importlib.util
import os
from pathlib import Path
import sys

sys.stdout.reconfigure(encoding='utf-8')
skill = Path(r'C:\Users\HUAWEI\.codex\plugins\cache\openai-primary-runtime\documents\26.1015.12040\skills\documents')
poppler = r'C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin'
os.environ['PATH'] = poppler + os.pathsep + os.environ.get('PATH', '')
spec = importlib.util.spec_from_file_location('packaged_renderer', skill / 'render_docx.py')
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

def native_pdf(input_path, user_profile, output_dir, stem, verbose=False):
    pdf = Path(input_path).with_suffix('.pdf')
    if not pdf.exists():
        raise FileNotFoundError('Export the DOCX with the native Word-compatible engine first: ' + str(pdf))
    if pdf.stat().st_mtime + 2 < Path(input_path).stat().st_mtime:
        raise RuntimeError('The exported PDF is older than its DOCX')
    return str(pdf), 'Windows native document export; bundled Poppler rasterization'

renderer.convert_to_pdf = native_pdf
renderer.main()
