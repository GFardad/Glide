# Plan: 100% Pre-Reboot Sunshine Virtual Display Verification

## Context
Host: arch-pc, Arch/Hyprland/NVIDIA RTX 3060 Ti
Sunshine must stream ONLY virtual `HDMI-A-4`, never fallback to `DP-2`, `DP-3`, `HDMI-A-5`.
If `HDMI-A-4` is unavailable, stream must show a disabled/blank capture, never a physical monitor.

## Critical Artifacts
- `/usr/lib/firmware/edid/sunshine-1080p60.bin`
- `/etc/default/grub`
- `/etc/mkinitcpio.conf`
- `/boot/grub/grub.cfg`
- `/home/gfardad/.config/sunshine/sunshine.conf`
- `/home/gfardad/.config/sunshine/apps.json`
- `/usr/local/bin/sunshine-monitor-enforcer.sh`
- `/etc/systemd/system/sunshine-output-enforcer.{service,timer}`
- `/home/gfardad/.config/systemd/user/sunshine.service`

## Verification Domains
1. EDID firmware validity + checksum stability
2. GRUB cmdline has both `drm.edid_firmware=HDMI-A-4:edid/sunshine-1080p60.bin` and `video=HDMI-A-4:e`
3. mkinitcpio FILES includes EDID and initramfs is newer than vmlinuz
4. /boot/grub/grub.cfg generated after EDID changes
5. sunshine.conf has exactly `output_name = HDMI-A-4` and no other `output_name` lines
6. apps.json has `Virtual Desktop (HDMI-A-4)` preset with do/undo prep-cmd
7. apps.json has NO mirror preset
8. enforcer script forces HDMI-A-4 and never falls back
9. enforcer systemd timer enabled and active
10. sunshine.service has correct Wayland env vars
11. EDID decode shows valid HDMI monitor, 1920x1080@60, checksum OK
12. No config file overrides output_name elsewhere
13. Network bind=0.0.0.0 and CSRF allowed origins present
14. sunshine.service enabled for user
15. Boot path: UEFI, snapshot ordering, initramfs rebuild order, no stale edits

## Success Criteria
- All 15 domains PASS with deterministic evidence
- Any FAIL is fixed before reboot
- Output format: `DOMAIN N: PASS/FAIL + evidence`
- Final recommendation: SAFE_TO_REBOOT or BLOCKER_LIST
