import os
import sys
import subprocess

def create_shortcuts():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    target_bat = os.path.join(script_dir, 'start.bat')
    desktop = os.path.join(os.environ.get('USERPROFILE', ''), 'Desktop')
    start_menu = os.path.join(os.environ.get('APPDATA', ''), 'Microsoft', 'Windows', 'Start Menu', 'Programs')

    desktop_shortcut = os.path.join(desktop, 'HarmoniX Music.lnk')
    start_menu_shortcut = os.path.join(start_menu, 'HarmoniX Music.lnk')

    # Buat VBScript temporary untuk membuat .lnk
    vbs_path = os.path.join(script_dir, '_shortcut_temp.vbs')
    vbs_code = f'''
Set oWS = WScript.CreateObject("WScript.Shell")

' Desktop Shortcut
Set oLinkDesktop = oWS.CreateShortcut("{desktop_shortcut}")
oLinkDesktop.TargetPath = "{target_bat}"
oLinkDesktop.WorkingDirectory = "{script_dir}"
oLinkDesktop.Description = "HarmoniX Music Player"
oLinkDesktop.Save

' Start Menu Shortcut
If "{os.path.exists(start_menu)}" = "True" Then
    Set oLinkStart = oWS.CreateShortcut("{start_menu_shortcut}")
    oLinkStart.TargetPath = "{target_bat}"
    oLinkStart.WorkingDirectory = "{script_dir}"
    oLinkStart.Description = "HarmoniX Music Player"
    oLinkStart.Save
End If
'''
    with open(vbs_path, 'w', encoding='utf-8') as f:
        f.write(vbs_code)

    try:
        subprocess.run(['cscript', '//nologo', vbs_path], check=True)
        print("=" * 60)
        print("  [SUCCESS] Pemasangan HarmoniX Desktop Selesai!")
        print("=" * 60)
        print(f"  -> Pintasan Desktop dibuat di: {desktop_shortcut}")
        print("  -> Anda sekarang dapat membuka HarmoniX langsung dari Desktop Windows!")
        print("=" * 60)
    finally:
        if os.path.exists(vbs_path):
            os.remove(vbs_path)

if __name__ == '__main__':
    create_shortcuts()
