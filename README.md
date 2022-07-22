# ollo

## Vue3环境插件

### 注册局部滚动指令

- 支持响应式变量

```ts
// main.ts (入口文件)
import { createApp } from 'vue';
import { scroller } from 'ollo';
import App from './App.vue';

const app = createApp(App);

app.use(scroller);
app.use(longtouch);
```

```html
<!-- case 1 -->
<template>
    <textarea v-scroll />
</template>

<!-- case 2 -->
<template>
    <textarea v-scroll="true" />
</template>

<!-- case 3 -->
<template>
    <textarea v-scroll="false" />
</template>

<!-- case 4 -->
<template>
    <textarea v-scroll="shouldScroll" />
</template>
```


```html
<!-- case 1 -->
<template>
    <!-- 单指按下400ms, 触发 -->
    <textarea v-longtouch="callback" />
</template>

<!-- case 2 -->
<template>
    <!-- 单指按下500ms, 触发 -->
    <textarea v-longtouch:500="callback" />
</template>

<script setup>
function callback() {
    // doSomething
}
</script>
```
