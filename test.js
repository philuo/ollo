// // 性能测试
// const COUNT = 100_0000;

// // 方案 A: Object 数组
// console.time('Object Array');
// const objArray = [];
// for (let i = 0; i < COUNT; i++) {
//     objArray.push({ x: i, y: i * 2, vx: 0, vy: 0 });
// }
// let sum1 = 0;
// for (let i = 0; i < COUNT; i++) {
//     sum1 += objArray[i].x + objArray[i].y;
// }
// console.timeEnd('Object Array');
// // 典型结果：~5-10ms

// // 方案 B: TypedArray
// console.time('TypedArray');
// const typed = new Float32Array(COUNT * 4);
// for (let i = 0; i < COUNT; i++) {
//     typed[i * 4 + 0] = i;
//     typed[i * 4 + 1] = i * 2;
// }
// let sum2 = 0;
// for (let i = 0; i < COUNT; i++) {
//     sum2 += typed[i * 4 + 0] + typed[i * 4 + 1];
// }
// console.timeEnd('TypedArray');
// // 典型结果：~1-2ms (快 3-5x！)

import { test } from './dist/ollo.js';


const N = 10_0000;

export function test_js(n) {
    let arr = new Array(n);

    for (let i = 0; i < n; ++i) {
        arr[i] = i;
    }
}


console.time('test_js');
test_js(N);
console.timeEnd('test_js');


console.time('test');
test(N);
console.timeEnd('test');

