# Plan: 100% Post-Reboot HDMI-A-4 Sunshine Verification

## Context
Post-reboot verification that Sunshine streams ONLY virtual HDMI-A-4 at 1920x1080@60, never falls back to DP-2/DP-3/HDMI-A-5.

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
1. EDID firmware validity + checksum + 1920x1080@60
2. GRUB cmdline has both `drm.edid_firmware=HDMI-A-4:edid/sunshine-1080p60.bin` and `video=HDMI-A-4:e`
3. mkinitcpio FILES includes EDID and initramfs is newer than vmlinuz
4. /boot/grub/grub.cfg generated after EDID changes
5. sunshine.conf has exactly `output_name = HDMI-A-4` and no other `output_name` lines
6. apps.json has `Virtual Desktop (HDMI-A-4)` preset with do/undo prep-cmd
7. apps.json has NO mirror preset
8. enforcer script forces HDMI-A-4 and never falls back
9. enforcer systemd timer enabled and active
10. sunshine.service has correct Wayland env vars
11. Post-reboot: `hyprctl monitors` shows `Monitor HDMI-A-4` with valid modes
12. Post-reboot: `cat /sys/class/drm/card2-HDMI-A-4/edid` is non-empty and valid
13. Post-reboot: `dmesg | grep -i edid` shows no invalid firmware errors
14. Post-reboot: Sunshine logs show `Selected monitor [HDMI-A-4] for streaming`
15. Post-reboot: Stream client receives ONLY HDMI-A-4 content, never DP-2/DP-3/HDMI-A-5

## Success Criteria
- All 15 domains PASS with deterministic evidence
- Any FAIL is fixed before declaring success
- Output format: `DOMAIN N: PASS/FAIL + evidence`
- Final recommendation: WORKING_PERFECTLY or BLOCKER_LIST
