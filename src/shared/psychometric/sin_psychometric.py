#!/usr/bin/env python3
"""
Fits a psychometric function to Words task scores and finds the SNR at 90% correct.
Usage: python sin_psychometric.py <summary_csv_path> <output_png_path>
Prints the recommended SNR level (integer dB) to stdout.
"""
import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import psignifit as ps
import psignifit.psigniplot as psp

SNR_LEVELS      = [25, 20, 15, 10, 5, 0]
ITEMS_PER_LEVEL = 20
TARGET          = 0.90


def main():
    if len(sys.argv) < 3:
        print("Usage: sin_psychometric.py <summary_csv_path> <output_png_path> [column]", file=sys.stderr)
        sys.exit(1)

    csv_path = sys.argv[1]
    png_path = sys.argv[2]
    column   = sys.argv[3] if len(sys.argv) > 3 else 'Words'

    # --- Load summary CSV ---
    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
    except Exception as e:
        print(f"Error reading CSV: {e}", file=sys.stderr)
        sys.exit(1)

    df['SNR_num'] = pd.to_numeric(df['SNR'], errors='coerce')
    df = df[df['SNR_num'].isin(SNR_LEVELS)].copy()
    df = df.sort_values('SNR_num', ascending=False).reset_index(drop=True)

    missing = set(SNR_LEVELS) - set(df['SNR_num'].astype(int))
    if missing:
        print(f"Missing SNR levels in summary: {sorted(missing, reverse=True)}", file=sys.stderr)
        sys.exit(1)

    # --- Build psignifit input [SNR, n_correct, n_total] ---
    data = np.array(
        [[float(row['SNR_num']), float(row[column]), float(ITEMS_PER_LEVEL)]
         for _, row in df.iterrows()],
        dtype=float
    )

    # --- Fit ---
    result = ps.psignifit(data, sigmoid='logistic', experiment_type='equal asymptote')

    # --- Find threshold ---
    snr_min, snr_max = min(SNR_LEVELS), max(SNR_LEVELS)
    x = np.linspace(snr_min, snr_max, 10000)
    y = result.proportion_correct(x)

    threshold_snr = None
    note = ''

    if y.max() < TARGET:
        note = f"not reached (max {y.max():.0%} at {snr_max} dB)"
        recommended_snr = snr_max
    elif y.min() >= TARGET:
        note = f"already ≥ {TARGET:.0%} at lowest SNR ({snr_min} dB)"
        recommended_snr = snr_min
    else:
        i = np.argmax(y >= TARGET)
        threshold_snr = float(np.interp(TARGET, [y[i - 1], y[i]], [x[i - 1], x[i]]))
        note = f"SNR at 90% = {threshold_snr:.1f} dB"
        above = [s for s in SNR_LEVELS if s >= threshold_snr]
        recommended_snr = min(above) if above else max(SNR_LEVELS)

    # --- Plot ---
    fig, ax = plt.subplots(figsize=(7, 5))
    psp.plot_psychometric_function(result, ax=ax)

    ax.axhline(TARGET, color='gray', linestyle='--', linewidth=1, label='90%')
    if threshold_snr is not None:
        ax.axvline(threshold_snr, color='red', linestyle='--', linewidth=1,
                   label=f'SNR = {threshold_snr:.1f} dB')
    else:
        ax.text(0.02, 0.05, note, transform=ax.transAxes, fontsize=9, color='red')

    ax.set_xlim(snr_min - 2, snr_max + 2)
    ax.set_title(f'{column} — Psychometric Function', fontsize=13)
    ax.set_xlabel('SNR (dB)', fontsize=11)
    ax.set_ylabel('Proportion correct', fontsize=11)
    ax.legend(fontsize=9)
    plt.tight_layout()
    plt.savefig(png_path, dpi=150, bbox_inches='tight')
    plt.close()

    # Print recommended SNR to stdout — read by Electron
    print(recommended_snr)


if __name__ == '__main__':
    main()
