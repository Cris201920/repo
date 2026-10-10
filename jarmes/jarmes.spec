# -*- mode: python ; coding: utf-8 -*-
# Gera dist/JARMES/ (use scripts/build_exe.ps1 no Windows). Um .exe só é produzido ao compilar NO Windows.
from PyInstaller.utils.hooks import collect_submodules

hidden = collect_submodules("jarmes") + ["PySide6.QtSvg", "PySide6.QtMultimedia", "PySide6.QtTextToSpeech"]
excludes = ["PySide6.QtWebEngineCore", "PySide6.QtWebEngineWidgets", "PySide6.QtQml", "PySide6.QtQuick", "PySide6.Qt3DCore",
            "PySide6.QtCharts", "PySide6.QtDataVisualization", "PySide6.QtBluetooth", "PySide6.QtSql", "tkinter"]

a = Analysis(
    ["run_jarmes.py"],
    pathex=["src"],
    datas=[("src/jarmes/assets", "jarmes/assets")],
    hiddenimports=hidden,
    excludes=excludes,
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="JARMES",
    console=False,
    icon="src/jarmes/assets/jarmes.ico",
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="JARMES")
