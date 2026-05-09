/**
 * Problem 4 — Three ways to compute the sum 1 + 2 + ... + n.
 *
 * Constraints (apply to all implementations):
 *   - `n` must be a non-negative integer.
 *   - `n = 0` returns 0.
 *   - The caller guarantees the n is less than or equal to `Number.MAX_SAFE_INTEGER`
 *     (≈ 9.0e15), which holds for n up to ≈ 1.34e8.
 */

/*
 The largest n such that the sum 1 + 2 + ... + n = n*(n+1)/2 does not exceed Number.MAX_SAFE_INTEGER.
 We solve for n: n*(n+1)/2 <= MAX_SAFE_INTEGER. 
   => n^2 + n - 2*MAX_SAFE_INTEGER <= 0.
   => n <= [-1 + sqrt(1 + 8*MAX_SAFE_INTEGER)]/2.
   => n <= [-1 + sqrt(1 + 8*MAX_SAFE_INTEGER)]/2. (Using the quadratic formula)
   => n <= [-1 + sqrt(1 + 8*MAX_SAFE_INTEGER)]/2. (We take Math.floor in case the answer is not integer.)
*/
const MAX_N = Math.round((Math.sqrt(8 * Number.MAX_SAFE_INTEGER + 1) - 1) / 2);

// Helper function to validate the input n
const validateInputContraints = (n: number): void => {
   try {
      if (!Number.isInteger(n)) throw new TypeError("n must be an integer");
      if (n < 0) throw new RangeError("n must be non-negative");
      if (n > MAX_N) throw new RangeError(`n must be <= ${MAX_N} so the result fits in Number.MAX_SAFE_INTEGER`);
   } catch (error) {
      console.error("Error validating input constraints:", error);
   }
};

/**
 * 
 * Recursive approach: sum_to_n_a(n) = n + sum_to_n_a(n - 1).
 *
 * Big-O:    Time O(n), Space O(n) — one call-stack frame per recursion step.
 *
 * n = 0 → returns 0 (base case).
 */
const sum_to_n_a = (n: number): number => {
   validateInputContraints(n);

   if (n === 0) return 0;
   return n + sum_to_n_a(n - 1);
};

/**
 * Iterative approach: accumulate 1..n in a loop.
 *
 * Big-O:    Time O(n), Space O(1) — no stack growth, single accumulator.
 *
 */
const sum_to_n_b = (n: number): number => {
   validateInputContraints(n);

   let sum = 0;
   for (let i = 1; i <= n; i++) sum += i;
   return sum;
};

/**
 * Mathematical formula approach (Gauss's formula): n * (n + 1) / 2.
 *
 * Big-O:    Time O(1), Space O(1) — optimal.
 *
 */
const sum_to_n_c = (n: number): number => {
   validateInputContraints(n);

   return n * ((n + 1) / 2);
};


// --- Optimized variants of sum_to_n_a -------------------------------------

/**
 * Tail-recursive form of sum_to_n_a, using an accumulator.
 *
 * Big-O:    Time O(n), Space O(n) on Node — same as the plain recursive form.
 *
 * Caveat: V8 does NOT perform tail-call optimisation (proper tail calls were
 * removed from Node). This version is stylistically tail-recursive but still
 * grows the call stack one frame per step, so it overflows at the same depth
 * as `sum_to_n_a`. On a TCO-capable runtime this would be O(1) space.
 */
const sum_to_n_a_tail = (n: number): number => {
   validateInputContraints(n);

   const go = (i: number, acc: number): number => (i === 0 ? acc : go(i - 1, acc + i));
   return go(n, 0);
};

/**
 * Tabulation (bottom-up DP): fill table[i] = table[i-1] + i for i in 1..n.
 *
 * Big-O:    Time O(n), Space O(n) for the table.
 *
 * Caveat: for this recurrence the table is unnecessary — only the previous
 * cell is ever read, so the table collapses to a single accumulator, which is
 * exactly `sum_to_n_b`. This variant is strictly worse than the iterative
 * version (same time, extra O(n) space) and is included only to illustrate
 * the bottom-up DP pattern.
 */
const sum_to_n_a_tab = (n: number): number => {
   validateInputContraints(n);

   const table = new Array<number>(n + 1); // Allocate n+1 entries so that indices 0..n are addressable.
   table[0] = 0;
   for (let i = 1; i <= n; i++) table[i] = (table[i - 1] as number) + i;
   return table[n] as number;
};

// --- Demo --------------------------------------------------------------------

const variants = {
   a_recursive: sum_to_n_a,
   b_iterative: sum_to_n_b,
   c_formula: sum_to_n_c,
   a_recursive_tco: sum_to_n_a_tail,
   a_recursive_dp_tabulation: sum_to_n_a_tab,
};

// Calling to test the functions and printing the results.
console.log("first column is the n value, the rest are the results for each function");
for (const n of [0, 5, 100]) {
   const results = Object.fromEntries(
      Object.entries(variants).map(([name, fn]) => [name, fn(n)])
   );
   // show result for each function in a table format
   console.table({ [n.toString()]: results }, [...Object.keys(variants)]);
}

// Edge cases: Surface the recursive approach stack-overflow caveat for both plain and tail-call optimization forms.
console.log("\nEdge cases: Surface the recursive approach stack-overflow caveat for both plain and tail-call optimization forms with n = 10_000 (example of large n). But other forms do not throw an error.\n");
for (const [name, fn] of [
   ["sum_to_n_a", sum_to_n_a],
   ["sum_to_n_a_tail", sum_to_n_a_tail],
   ["sum_to_n_a_dp_tabulation", sum_to_n_a_tab],
   ["sum_to_n_b", sum_to_n_b],
   ["sum_to_n_c", sum_to_n_c],
] as const) {
   try {
      let result = fn(10_000);
      console.log(`${name}(10_000) = ${result}. Not overflowed.`);
   } catch (err) {
      console.log(`${name}(10_000) threw error: ${(err as Error).message} (expected). --> Stack overflowed.`);
   }
}
