"""Inicialização do aplicativo."""
from __future__ import annotations

import argparse
import logging
import shutil
import sys
from pathlib import Path


def apply_pending_restore(data_dir: Path) -> str | None:
    """Se o usuário agendou uma restauração de backup, aplica antes de abrir o banco."""
    marker = data_dir / "restore.pending"
    if not marker.exists():
        return None
    try:
        src = Path(marker.read_text(encoding="utf-8").strip())
        db = data_dir / "jarmes.db"
        if src.is_file():
            for ext in ("-wal", "-shm"):
                Path(str(db) + ext).unlink(missing_ok=True)
            shutil.copy2(src, db)
            return f"Backup restaurado: {src.name}"
        return f"Backup não encontrado: {src}"
    finally:
        marker.unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jarmes", description="JARMES — assistente pessoal de estudos e rotina")
    parser.add_argument("--minimized", action="store_true", help="inicia na bandeja do sistema")
    parser.add_argument("--smoke-test", action="store_true", help="abre a interface, renderiza todas as páginas e sai (diagnóstico)")
    parser.add_argument("--screenshots", metavar="PASTA", help="salva uma imagem de cada página (desenvolvimento)")
    parser.add_argument("--data-dir", metavar="PASTA", help="usa outra pasta de dados")
    args = parser.parse_args(argv)

    from PySide6.QtCore import QLockFile, Qt
    from PySide6.QtWidgets import QApplication, QMessageBox

    from . import APP_NAME, __version__
    from .app_context import AppContext
    from .config import Config
    from .logging_setup import redact, setup_logging
    from .ui.icons import app_icon
    from .ui.main_window import MainWindow
    from .ui.theme import QSS

    config = Config.load(Path(args.data_dir) if args.data_dir else None)
    config.ensure_dirs()
    logger = setup_logging(config.logs_dir)
    restored = apply_pending_restore(config.data_dir)

    app = QApplication(sys.argv[:1])
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(__version__)
    app.setOrganizationName("JARMES")
    app.setStyle("Fusion")
    app.setStyleSheet(QSS)
    app.setWindowIcon(app_icon())
    app.setQuitOnLastWindowClosed(False)

    lock = QLockFile(str(config.data_dir / "jarmes.lock"))
    lock.setStaleLockTime(0)
    if not args.smoke_test and not args.screenshots and not lock.tryLock(100):
        if not args.minimized:
            QMessageBox.information(None, "JARMES", "O JARMES já está em execução (procure o ícone na bandeja do sistema).")
        return 0

    def excepthook(exc_type, exc, tb):
        logger.error("Exceção não tratada: %s", redact(f"{exc_type.__name__}: {exc}"), exc_info=(exc_type, exc, tb))

    sys.excepthook = excepthook

    ctx = AppContext(config)
    if ctx.db.recovered_from:
        logger.warning("Banco recuperado do backup %s", ctx.db.recovered_from)
    ctx.daily_backup_if_needed()
    win = MainWindow(ctx, start_minimized=args.minimized)
    if restored:
        win.toast("Restauração", restored)
    if ctx.db.recovered_from:
        win.toast("Banco recuperado", f"O banco estava corrompido e foi restaurado do backup {ctx.db.recovered_from.name}.")

    if args.smoke_test or args.screenshots:
        win.show()
        out = Path(args.screenshots) if args.screenshots else None
        if out:
            out.mkdir(parents=True, exist_ok=True)
        for key in win.pages:
            win.navigate(key)
            app.processEvents()
            app.processEvents()
            if out:
                win.grab().save(str(out / f"{key}.png"))
        print(f"OK: {len(win.pages)} páginas renderizadas.")
        ctx.close()
        return 0

    if args.minimized and win.tray_available:
        logger.info("Iniciado minimizado na bandeja.")
    else:
        win.show()
    code = app.exec()
    ctx.close()
    lock.unlock()
    return code
