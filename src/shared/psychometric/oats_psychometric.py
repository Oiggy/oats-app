#!/usr/bin/env python3
"""
One entry point for the three psychometric scripts, so the Windows installer
can ship them as a single self-contained program (built with PyInstaller by
.github/workflows/windows-installer.yml; Python is not needed on the PC).

Usage: oats_psychometric <kind> <script arguments...>
  kind  sin   sin_psychometric.py   (Words / Nonwords; prints recommended SNR)
        hint  hint_psychometric.py
        cst   cst_psychometric.py

The scripts themselves are unchanged; each gets the same arguments it would
get when run as `python <script>.py ...`.
"""
import sys

# Static imports so PyInstaller bundles all three scripts
import sin_psychometric
import hint_psychometric
import cst_psychometric

SCRIPTS = {
    'sin': sin_psychometric,
    'hint': hint_psychometric,
    'cst': cst_psychometric,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in SCRIPTS:
        print(f"Usage: oats_psychometric <{'|'.join(SCRIPTS)}> <arguments...>", file=sys.stderr)
        sys.exit(2)
    script = SCRIPTS[sys.argv[1]]
    sys.argv = [script.__file__] + sys.argv[2:]
    script.main()


if __name__ == '__main__':
    main()
