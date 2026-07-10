@echo off
title Construtrack - Servidor
echo ============================================
echo  CONSTRUTRACK - iniciando servidor local...
echo  Nao feche esta janela enquanto usar o app.
echo ============================================
cd /d "%~dp0server"
node server.js
pause
