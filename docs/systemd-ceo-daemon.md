# GlideLoop CEO Daemon Systemd Setup

Use this if you want the CEO daemon to restart automatically on login/crash.

```bash
systemctl --user daemon-reload
systemctl --user enable --now glideloop-ceo-daemon.service
journalctl --user -u glideloop-ceo-daemon.service -f
```

The service file lives at:
`/home/gfardad/.config/systemd/user/glideloop-ceo-daemon.service`
