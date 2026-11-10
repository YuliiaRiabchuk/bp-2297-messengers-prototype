import { copyFileSync } from 'node:fs'

// GitHub Pages віддає 404.html на будь-який невідомий шлях. Копія index.html
// під цим іменем робить прямий вхід за глибоким посиланням робочим без роутера на сервері.
copyFileSync('dist/index.html', 'dist/404.html')
console.log('dist/404.html — копія index.html для прямого входу за посиланням')
