; Inno Setup 6 — gera dist\JARMES-Setup.exe a partir de dist\JARMES\ (rode scripts\build_exe.ps1 antes)
[Setup]
AppName=JARMES
AppVersion=0.1.0
AppPublisher=JARMES
DefaultDirName={autopf}\JARMES
DefaultGroupName=JARMES
OutputDir=..\dist
OutputBaseFilename=JARMES-Setup
SetupIconFile=..\src\jarmes\assets\jarmes.ico
UninstallDisplayIcon={app}\JARMES.exe
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; Flags: unchecked
Name: "autostart"; Description: "Iniciar com o Windows (minimizado na bandeja)"; Flags: unchecked

[Files]
Source: "..\dist\JARMES\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\JARMES"; Filename: "{app}\JARMES.exe"
Name: "{autodesktop}\JARMES"; Filename: "{app}\JARMES.exe"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "JARMES"; ValueData: """{app}\JARMES.exe"" --minimized"; Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "{app}\JARMES.exe"; Description: "Abrir o JARMES"; Flags: nowait postinstall skipifsilent

; Desinstalar remove o programa; seus dados ficam em %APPDATA%\JARMES (apague manualmente se quiser).
