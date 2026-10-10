"""Inicialização com o Windows (chave HKCU\\...\\Run, sem privilégios de administrador).

Só tem efeito no Windows. Para lembretes após fechar a janela, o JARMES precisa continuar em execução na bandeja
do sistema: ative também 'Minimizar para a bandeja ao fechar'."""
from __future__ import annotations

import sys

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
VALUE_NAME = "JARMES"


class AutostartUnsupported(RuntimeError):
    pass


def _winreg():
    if not sys.platform.startswith("win"):
        raise AutostartUnsupported("A inicialização automática só está disponível no Windows.")
    import winreg
    return winreg


def launch_command() -> str:
    if getattr(sys, "frozen", False):          # executável gerado pelo PyInstaller
        return f'"{sys.executable}" --minimized'
    exe = sys.executable.replace("python.exe", "pythonw.exe") if sys.platform.startswith("win") else sys.executable
    return f'"{exe}" -m jarmes --minimized'


def is_enabled(winreg=None) -> bool:
    try:
        wr = winreg or _winreg()
        with wr.OpenKey(wr.HKEY_CURRENT_USER, RUN_KEY, 0, wr.KEY_READ) as key:
            wr.QueryValueEx(key, VALUE_NAME)
            return True
    except (AutostartUnsupported, OSError):
        return False


def enable(command: str | None = None, winreg=None) -> None:
    wr = winreg or _winreg()
    with wr.OpenKey(wr.HKEY_CURRENT_USER, RUN_KEY, 0, wr.KEY_SET_VALUE) as key:
        wr.SetValueEx(key, VALUE_NAME, 0, wr.REG_SZ, command or launch_command())


def disable(winreg=None) -> None:
    wr = winreg or _winreg()
    try:
        with wr.OpenKey(wr.HKEY_CURRENT_USER, RUN_KEY, 0, wr.KEY_SET_VALUE) as key:
            wr.DeleteValue(key, VALUE_NAME)
    except FileNotFoundError:
        pass
