@echo off
setlocal
cd /d "%~dp0"
set "PY_CMD="
where py >nul 2>nul && set "PY_CMD=py -3 -S"
if not defined PY_CMD where python >nul 2>nul && set "PY_CMD=python -S"
if not defined PY_CMD (
  echo Python 3 が見つかりませんでした。
  echo Python 3 をインストールしてから、もう一度実行してください。
  pause
  exit /b 1
)
%PY_CMD% start_game_center.py
