#!/usr/bin/env python3
"""CLI: run session watchdog and print stale agents."""

from __future__ import annotations

import sys

from runtime.meta.watchdog.session_watchdog import main

sys.exit(main())
