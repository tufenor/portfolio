"""Automacoes deterministicas e seguras do MoneyIA.

Os modulos nao fazem login, cadastro, envio comercial ou movimentacao financeira.
Operacoes externas permanecem explicitamente em dry-run ate autorizacao.
"""

from .supervisor import run_snapshot

__all__ = ["run_snapshot"]
