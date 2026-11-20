#!/usr/bin/env python3
"""
Fits a psychometric function to HINT keyword scores and plots the result.
Usage: python hint_psychometric.py <summary_csv_path> <output_png_path>
Prints nothing to stdout (no SNR recommendation for HINT).
"""
import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import psignifit as ps
import psignifit.psigniplot as psp

SNR_LEVELS = [25, 20, 15, 10, 5, 0, -5]
TARGET     = 0.50   # 50% keyword correct is the conventional HINT threshold


def main():
    if len(sys.argv) < 3:
        print("Usage: hint_psychometric.py <summary_csv_path> <output_png_path>", file=sys.stderr)
        sys.exit(1)

    csv_path = sys.argv[1]
    png_path = sys.argv[2]
    max_snr  = float(sys.argv[3]) if len(sys.argv) > 3 else None

    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
    except Exception as e:
        print(f"Error reading CSV: {e}", file=sys.stderr)
        sys.exit(1)

    df['SNR_num'] = pd.to_numeric(df['SNR'], errors='coerce')
    df = df[df['SNR_num'].notna()].copy()
    if max_snr is not None:
        df = df[df['SNR_num'] <= max_snr]
    df = df[df['HINT'].astype(str).str.strip() != '']

    if df.empty:
        print("No HINT data found in summary CSV.", file=sys.stderr)
        sys.exit(1)

    # Parse "correct/total" cells
    rows = []
    for _, row in df.iterrows():
        cell = str(row['HINT']).strip()
        if '/' not in cell:
            continue
        correct_s, total_s = cell.split('/', 1)
        try:
            correct = float(correct_s)
            total   = float(total_s)
        except ValueError:
            continue
        if total == 0:
            continue
        rows.append((float(row['SNR_num']), correct, total))

    if len(rows) < 3:
        print(f"Not enough HINT data points to fit ({len(rows)} found, need ≥ 3).", file=sys.stderr)
        sys.exit(1)

    rows.sort(key=lambda x: x[0])
    data = np.array(rows, dtype=float)

    result = ps.psignifit(data, sigmoid='logistic', experiment_type='equal asymptote')

    snr_min, snr_max = data[:, 0].min(), data[:, 0].max()
    x = np.linspace(snr_min, snr_max, 10000)
    y = result.proportion_correct(x)

    def find_threshold(level):
        if y.min() < level < y.max():
            i = np.argmax(y >= level)
            return float(np.interp(level, [y[i-1], y[i]], [x[i-1], x[i]]))
        return None

    snr_50  = find_threshold(0.50)
    snr_90  = find_threshold(0.90)

    fig, ax = plt.subplots(figsize=(7, 5))
    psp.plot_psychometric_function(result, ax=ax)
    ax.axhline(0.50, color='gray',  linestyle='--', linewidth=1, label='50%')
    ax.axhline(0.90, color='blue',  linestyle='--', linewidth=1, label='90%')
    if snr_50 is not None:
        ax.axvline(snr_50, color='red',  linestyle='--', linewidth=1,
                   label=f'50%: {snr_50:.1f} dB')
    if snr_90 is not None:
        ax.axvline(snr_90, color='blue', linestyle='--', linewidth=1,
                   label=f'90%: {snr_90:.1f} dB')
    if snr_50 is None and snr_90 is None:
        note = f"Thresholds not crossed in [{snr_min:.1f}, {snr_max:.1f}] dB"
        ax.text(0.02, 0.05, note, transform=ax.transAxes, fontsize=9, color='red')

    ax.set_xlim(snr_min - 2, snr_max + 2)
    ax.set_title('HINT — Psychometric Function', fontsize=13)
    ax.set_xlabel('SNR (dB)', fontsize=11)
    ax.set_ylabel('Proportion correct', fontsize=11)
    ax.legend(fontsize=9)
    plt.tight_layout()
    plt.savefig(png_path, dpi=150, bbox_inches='tight')
    plt.close()


if __name__ == '__main__':
    main()
