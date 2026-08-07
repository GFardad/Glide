"""CTO Manager CLI."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from runtime.manager.cto_manager import CTOManager, CTOManagerConfig
from runtime.manager.metrics import MetricsDashboard
from runtime.manager.reports import ReportSystem
from runtime.logging import get_logger


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CTO Manager")
    subparsers = parser.add_subparsers(dest="command")

    check_parser = subparsers.add_parser("check", help="Check all teams")
    check_parser.add_argument("--interval", type=int, default=60, help="Check interval in seconds")

    register_parser = subparsers.add_parser("register", help="Register a team")
    register_parser.add_argument("name", help="Team name")
    register_parser.add_argument("--version", default="next", help="Version")

    report_parser = subparsers.add_parser("report", help="Generate report")
    report_parser.add_argument("--type", choices=["daily", "weekly"], default="daily")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    root = Path("/home/gfardad/projects/glideloop")
    logger = get_logger("glideloop.manager")
    manager = CTOManager(CTOManagerConfig(root=root))
    dashboard = MetricsDashboard()
    reports = ReportSystem()

    if args.command == "register":
        manager.register_team(args.name, {"version": args.version})
        return 0

    if args.command == "check":
        statuses = manager.check_teams()
        if not statuses:
            print("No teams registered")
        for name, status in statuses.items():
            print(f"{name}: {status['status']}")
        dashboard.collect()
        return 0

    if args.command == "report":
        snapshot = dashboard.collect()
        if args.type == "daily":
            report = reports.generate_daily(snapshot.data)
            print(f"Daily report: {report}")
        else:
            report = reports.generate_weekly(snapshot.data)
            print(f"Weekly report: {report}")
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
