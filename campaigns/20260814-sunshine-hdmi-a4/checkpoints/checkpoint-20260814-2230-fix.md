# Sunshine HDMI-A-4 Checkpoint — 2026-08-14 22:30

## Status: WORKING ✅

## Problem
Client connections failed with:  
`failed to start the virtual desktop (HDMI-A-4) (error 503)`

Sunshine logs showed:
```
Error: [wayland] Couldn't connect to Wayland display: wayland-1
Fatal: Unable to find display or encoder during startup
Error: Couldn't find monitor [263148674]
```

## Root Cause
1. **Wayland backend (wlgrab) fails at startup**: `wl_display_connect("wayland-1")` returns null at 20:52:38. The exact reason was not isolated, but evidence points to a session/socket timing issue at boot.
2. **KMS fallback is broken for virtual HDMI-A-4**: Sunshine falls back to KMS when wlgrab fails. KMS backend generates monitor ID `263148674` for `output_name=HDMI-A-4`, which doesn't match any DRM connector. This causes the fatal error that blocks ALL 4 encoders.
3. **Missing config directive**: Without `capture = wlr` in `sunshine.conf`, Sunshine auto-selects KMS first, triggering the broken monitor mapping path.

## Fix Applied
Added `capture = wlr` to `/home/gfardad/.config/sunshine/sunshine.conf`:

```ini
bind = 0.0.0.0
csrf_allowed_origins = https://192.168.1.200:47991
port = 47990
sunshine_name = arch-pc
output_name = HDMI-A-4
capture = wlr
```

## Hardening Applied
Updated `/usr/local/bin/sunshine-monitor-enforcer.sh` to enforce BOTH:
- `output_name = HDMI-A-4`
- `capture = wlr`

The enforcer now runs every 30s via systemd timer and will:
1. Fix `output_name` if it drifts
2. Fix `capture` if it drifts or is removed
3. Restart Sunshine only if a fix was needed

This prevents the exact failure mode that caused the 503.

## Why This Works
`capture = wlr` forces Sunshine to use the **Wayland wlgrab backend**, bypassing the broken KMS monitor index mapping. The wlgrab backend correctly enumerates monitors via `xdg_output` and selects `HDMI-A-4`.

Logs now show:
```
[wayland] Found display [wayland-1]
[wlgrab] Selected monitor [ChangHong Electric Co.,Ltd GDM-225JN 0000000000001 (HDMI-A-4)] for streaming
```

## Key Files
| File | Purpose | Mutable? |
|------|---------|----------|
| `/home/gfardad/.config/sunshine/sunshine.conf` | Sunshine config — **must contain `capture = wlr`** | YES — enforcer protects it |
| `/home/gfardad/.config/sunshine/apps.json` | Virtual Desktop preset for HDMI-A-4 | YES — user-editable |
| `/usr/local/bin/sunshine-monitor-enforcer.sh` | **Hardened** enforcer for `output_name` + `capture` | NO — system file |
| `/etc/systemd/system/sunshine-output-enforcer.timer` | Runs enforcer every 30s | NO — system file |
| `/etc/systemd/system/sunshine-output-enforcer.service` | Oneshot service unit | NO — system file |
| `/usr/lib/firmware/edid/sunshine-1080p60.bin` | Valid EDID firmware for virtual HDMI-A-4 | NO — kernel uses at boot |
| `/etc/default/grub` | Contains `drm.edid_firmware=HDMI-A-4:edid/sunshine-1080p60.bin video=HDMI-A-4:e` | NO — kernel cmdline |
| `/usr/local/bin/sunshine-wrapper` | Wrapper that sets `cap_sys_admin+ep` on `/usr/bin/sunshine` | NO — system file |

## Verification Commands
Run these to confirm everything is working:

```bash
# 1. Check config has both required lines
grep -E 'output_name|capture' /home/gfardad/.config/sunshine/sunshine.conf

# 2. Check service is active
systemctl --user is-active sunshine.service

# 3. Check enforcer timer is active
systemctl --user is-active sunshine-output-enforcer.timer

# 4. Check logs for wlgrab success (NO "Couldn't find monitor" errors)
grep -c "Couldn't find monitor" /home/gfardad/.config/sunshine/sunshine.log || echo "0 — GOOD"

# 5. Check wlgrab selected HDMI-A-4
grep "Selected monitor" /home/gfardad/.config/sunshine/sunshine.log | tail -1

# 6. Test local API reachability
curl -sk https://localhost:47991/api/config
```

Expected output:
- Config shows `output_name = HDMI-A-4` AND `capture = wlr`
- Service: `active`
- Timer: `active`
- `Couldn't find monitor` count: `0`
- Last `Selected monitor` line shows `(HDMI-A-4)`
- API returns `{"error":"Unauthorized","status":false,"status_code":401}` (401 is expected without auth)

## Rollback / Re-fix Procedure

### If `capture = wlr` is accidentally removed or commented out:
```bash
# The enforcer will fix it within 30s, or force it now:
sed -i '/^output_name = HDMI-A-4$/a capture = wlr' /home/gfardad/.config/sunshine/sunshine.conf
systemctl --user restart sunshine.service
grep -E 'capture|Selected monitor' /home/gfardad/.config/sunshine/sunshine.log | tail -3
```

### If Sunshine fails to start after reboot:
```bash
# Check logs for the exact error
journalctl --user -u sunshine.service --since "5 min ago"

# Common issues:
# 1. wayland-1 socket missing → check if Hyprland started
# 2. EDID firmware missing → check /boot/grub/grub.cfg for drm.edid_firmware param
# 3. Config drift → enforcer timer runs every 30s to fix output_name + capture
```

### If client still gets 503 after this fix:
```bash
# 1. Verify both config lines are present
grep -E 'output_name|capture' /home/gfardad/.config/sunshine/sunshine.conf

# 2. Check if wlgrab actually started
grep "Selected monitor" /home/gfardad/.config/sunshine/sunshine.log | tail -1

# 3. If KMS path is still being used, the enforcer should have fixed it within 30s.
#    If not, manually add: capture = wlr
#    Then restart: systemctl --user restart sunshine.service

# 4. If wayland-1 connection fails, check socket:
ls -la /run/user/1000/wayland-1
# Should be srwxr-xr-x owned by gfardad:gfardad
```

### If enforcer itself breaks:
```bash
# Test it manually
sudo -S -p '' /usr/local/bin/sunshine-monitor-enforcer.sh

# Check it didn't corrupt config
cat /home/gfardad/.config/sunshine/sunshine.conf

# Re-run if needed
sudo -S -p '' /usr/local/bin/sunshine-monitor-enforcer.sh
```

## How We Found This (Audit Trail)
- Dispatched 15 parallel subagents (deleg_a2b030e6) for capture backend analysis
- Source code analysis of `/tmp/Sunshine/src/platform/linux/misc.cpp:1348` (backend selection)
- Source code analysis of `/tmp/Sunshine/src/platform/linux/kmsgrab.cpp:858` (monitor index mapping)
- Source code analysis of `/tmp/Sunshine/src/platform/linux/kmsgrab.cpp:1067` (fatal error)
- Live config test: toggled `capture = wlr` on/off, observed log behavior
- Confirmed wlgrab path works, KMS path fails with exact same `263148674` error
- Hardened enforcer to prevent config drift on BOTH `output_name` AND `capture`

## If This Breaks Again
1. Check if Sunshine version changed: `pacman -Q sunshine`
2. Check if config drifted: `cat /home/gfardad/.config/sunshine/sunshine.conf`
3. Check if enforcer is running: `systemctl --user status sunshine-output-enforcer.timer`
4. Re-run the capture backend test: temporarily set `capture = kms` and check logs — if KMS works, the virtual display mapping changed
5. Check upstream Sunshine issues for `wlgrab` or `Couldn't find monitor` fixes
