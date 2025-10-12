export function test(n: u32): void {
    const arr: StaticArray<u32> = new StaticArray<u32>(n);

    for (let i: u32 = 0; i < n; ++i) {
        unchecked(arr[i] = i);
    }
}