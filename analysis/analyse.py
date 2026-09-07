
import pandas as pd
from scipy import stats
from itertools import combinations

CSV_PATH = "../benchmark/results/results-MERGED-1788364838373.csv"  # update if your filename differs
df = pd.read_csv(CSV_PATH)

SCENARIOS = df["scenario"].unique()
ENVIRONMENTS = ["E1", "E2", "E3"]
FRAMEWORKS = ["Vanilla", "React", "Angular"]
METRICS = ["timeMs", "ttiMs", "peakHeapKB"]


ALPHA = 0.05
NUM_COMPARISONS = len(SCENARIOS) * len(ENVIRONMENTS) * len(METRICS)
BONFERRONI_ALPHA = ALPHA / NUM_COMPARISONS


def cohens_d(a, b):
    """
    Cohen's d effect size between two independent samples.
    Returns (d, note) - note explains special cases.
    """
    na, nb = len(a), len(b)
    
    # Calculate standard deviations
    std_a = a.std(ddof=1)
    std_b = b.std(ddof=1)
    
    # Detect zero-variance groups
    zero_var_a = std_a < 1e-10
    zero_var_b = std_b < 1e-10
    
    mean_diff = a.mean() - b.mean()
    abs_diff = abs(mean_diff)
    
    # Case 1: Both groups have zero variance
    if zero_var_a and zero_var_b:
        if abs_diff < 1e-10:
            return 0.0, "identical (no variance, no difference)"
        else:
            # No way to compute Cohen's d, but this is a LARGE effect
            # Return the difference itself as a "d-like" magnitude
            return abs_diff, f"PERFECT_SEPARATION (both zero variance; raw diff = {mean_diff:.1f})"
    
    # Case 2: One group has zero variance
    if zero_var_a or zero_var_b:
        # Use the non-zero variance group's std as the denominator
        pooled_std = std_a if not zero_var_a else std_b
        if pooled_std < 1e-10:
            return abs_diff, f"PERFECT_SEPARATION (near-zero variance; raw diff = {mean_diff:.1f})"
        d = mean_diff / pooled_std
        return d, f"unstable (one group zero variance; raw diff = {mean_diff:.1f})"
    
    # Normal case: both groups have variance
    pooled_std = (
        ((na - 1) * std_a ** 2 + (nb - 1) * std_b ** 2)
        / (na + nb - 2)
    ) ** 0.5
    
    if pooled_std < 1e-10:
        return abs_diff, f"PERFECT_SEPARATION (pooled_std near zero; raw diff = {mean_diff:.1f})"
    
    d = mean_diff / pooled_std
    
    # Flag anything with |d| > 10 as suspect
    if abs(d) > 10:
        return d, f"unstable (extremely small within-group variance; raw mean difference = {mean_diff:.1f})"
    
    return d, None


def interpret_d(d):
    """Rough conventional interpretation of Cohen's d magnitude."""
    d = abs(d)
    if d < 0.2:
        return "negligible"
    elif d < 0.5:
        return "small"
    elif d < 0.8:
        return "medium"
    else:
        return "large"



print("=" * 100)
print("STEP 1: Median + IQR summary")
print("=" * 100)

summary_rows = []
for scenario in SCENARIOS:
    for env in ENVIRONMENTS:
        for fw in FRAMEWORKS:
            subset = df[
                (df["scenario"] == scenario)
                & (df["environment"] == env)
                & (df["framework"] == fw)
            ]
            if subset.empty:
                continue
            row = {"scenario": scenario, "environment": env, "framework": fw}
            for metric in METRICS:
                vals = subset[metric]
                row[f"{metric}_median"] = vals.median()
                row[f"{metric}_q1"] = vals.quantile(0.25)
                row[f"{metric}_q3"] = vals.quantile(0.75)
            summary_rows.append(row)

summary_df = pd.DataFrame(summary_rows)
summary_df.to_csv("summary-median-iqr.csv", index=False)
print("Saved: summary-median-iqr.csv")
print(summary_df.to_string(index=False))


print("\n" + "=" * 100)
print(f"STEP 2-4: Kruskal-Wallis (Bonferroni alpha = {BONFERRONI_ALPHA:.6f}), pairwise Mann-Whitney U, Cohen's d")
print("=" * 100)

test_results = []

for scenario in SCENARIOS:
    for env in ENVIRONMENTS:
        for metric in METRICS:
            groups = {}
            for fw in FRAMEWORKS:
                subset = df[
                    (df["scenario"] == scenario)
                    & (df["environment"] == env)
                    & (df["framework"] == fw)
                ]
                if not subset.empty:
                    groups[fw] = subset[metric]

            if len(groups) < 2:
                continue

            
            h_stat, p_value = stats.kruskal(*groups.values())
            significant = p_value < BONFERRONI_ALPHA

            result_row = {
                "scenario": scenario,
                "environment": env,
                "metric": metric,
                "kruskal_h": round(h_stat, 3),
                "kruskal_p": p_value,
                "significant_after_bonferroni": significant,
            }
            test_results.append(result_row)

            print(
                f"[{scenario:<20}][{env}][{metric:<12}] "
                f"H={h_stat:.3f}, p={p_value:.6f} "
                f"{'*** SIGNIFICANT ***' if significant else '(not significant)'}"
            )

           
            if significant:
                for fw_a, fw_b in combinations(groups.keys(), 2):
                    u_stat, mw_p = stats.mannwhitneyu(
                        groups[fw_a], groups[fw_b], alternative="two-sided"
                    )
                    d, note = cohens_d(groups[fw_a], groups[fw_b])
                    
                    # FIXED: Check d is None FIRST
                    if d is None:
                        print(
                            f"    {fw_a} vs {fw_b}: "
                            f"Mann-Whitney U p={mw_p:.6f}, "
                            f"Cohen's d: {note}"
                        )
                    elif note and "PERFECT_SEPARATION" in note:
                        print(
                            f"    {fw_a} vs {fw_b}: "
                            f"Mann-Whitney U p={mw_p:.6f}, "
                            f"PERFECT SEPARATION (d~{d:.1f}) - {note}"
                        )
                    elif note:
                        print(
                            f"    {fw_a} vs {fw_b}: "
                            f"Mann-Whitney U p={mw_p:.6f}, "
                            f"Cohen's d={d:.3f} [{note}]"
                        )
                    else:
                        print(
                            f"    {fw_a} vs {fw_b}: "
                            f"Mann-Whitney U p={mw_p:.6f}, "
                            f"Cohen's d={d:.3f} ({interpret_d(d)})"
                        )

results_df = pd.DataFrame(test_results)
results_df.to_csv("statistical-tests.csv", index=False)
print("\nSaved: statistical-tests.csv")


print("\n" + "=" * 100)
print("STEP 5: Degradation gradient (E3 median / E1 median) per framework/scenario/metric")
print("=" * 100)

gradient_rows = []
for scenario in SCENARIOS:
    for fw in FRAMEWORKS:
        for metric in METRICS:
            e1_subset = df[
                (df["scenario"] == scenario)
                & (df["environment"] == "E1")
                & (df["framework"] == fw)
            ]
            e3_subset = df[
                (df["scenario"] == scenario)
                & (df["environment"] == "E3")
                & (df["framework"] == fw)
            ]
            if e1_subset.empty or e3_subset.empty:
                continue

            e1_med = e1_subset[metric].median()
            e3_med = e3_subset[metric].median()
            ratio = e3_med / e1_med if e1_med != 0 else float("nan")

            gradient_rows.append(
                {
                    "scenario": scenario,
                    "framework": fw,
                    "metric": metric,
                    "e1_median": e1_med,
                    "e3_median": e3_med,
                    "degradation_ratio": round(ratio, 3),
                }
            )
            print(
                f"[{scenario:<20}][{fw:<8}][{metric:<12}] "
                f"E1={e1_med:.1f} -> E3={e3_med:.1f} | Ratio: {ratio:.2f}x"
            )

gradient_df = pd.DataFrame(gradient_rows)
gradient_df.to_csv("degradation-gradient.csv", index=False)
print("\nSaved: degradation-gradient.csv")

print("\nAnalysis complete. Three CSV files saved in the analysis/ folder:")
print("  - summary-median-iqr.csv")
print("  - statistical-tests.csv")
print("  - degradation-gradient.csv")