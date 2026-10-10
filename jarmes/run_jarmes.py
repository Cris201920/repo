"""Ponto de entrada para executar o JARMES a partir do código-fonte (sem instalar o pacote)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from jarmes.app import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
