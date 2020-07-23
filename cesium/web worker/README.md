# Cesium中的异步+'多线程'

## 浏览器的多进程与js的单线程

### 浏览器进程

1. Browser进程：浏览器主进程，只有一个。作用：
   + 负责浏览器界面显示，与用户交互。如前进，后退等
   + 负责各个页面的管理，创建销毁其他进程
   + 将Renderer进程得到的内存中的Bitmap（位图：使用像素阵列来表示的图像。），绘制到用户界面
   + 网络资源的管理，下载等
2. 第三方插件进程：每种类型的插件对应一个进程，仅当使用该插件时创建
3. GPU进程：最多一个，用于3D绘制等
4. 浏览器渲染进程（Renderer进程）：默认新开一个tab页面是一个进程，互不影响。
  
### 浏览器多进程的优势

+ 避免单个页面crash影响整个浏览器
+ 避免第三方插件crash影响整个浏览器
+ 充分利用多核优势

### 浏览器渲染进程（Renderer进程）内部的多线程

对于普通的前端操作，都是由渲染进程控制的，页面的渲染，js的执行，事件的循环，都是在这个进程内进行。渲染进程是多线程的

1. GUI渲染线程
   + 负责渲染浏览器界面，解析HTML，CSS，构建DOM树和Render树，布局和绘制等
   + 当界面需要重绘或重排时，该线程会执行
2. js引擎线程
   + 也称js内核，负责处理javascript脚本程序
   + 一个tab页中（Renderer进程）中无论什么时候都只有一个js线程在运行js程序
3. 事件触发线程
   + 归属于浏览器而不是js引擎，用来控制时间循环，管理一个任务队列
   + 当js引擎执行代码块如setTimeOut、鼠标点击、异步请求等，会将对应的任务添加到事件线程中
   + 当对应的时间符合触发条件触发时，该线程会把事件添加到任务队列的队尾
4. 定时触发器线程
   + setInterval与setTimeout所在线程
   + 因为js引擎是单线程，如果线程阻塞状态的时候就会影响计时准确性，所以需要通过定时触发器线程计时，计时完毕后，添加到由事件触发器线程管理的任务队列中，等待js引擎空闲后执行
5. 异步http请求线程
   + 在XMLHttpRequest连接后通过浏览器新开一个线程请求
   + 在检测到状态变更时，如果设置又回调函数，该线程就产生状态变更事件，将回调放入任务队列中，再由javascript引擎执行
  
**注意**：
+ 由于js是可以操纵DOM的，如果在修改DOM的同时渲染界面（js线程和GUI线程同时运行）那么渲染线程前后获得的元素数据就可能不一致
+ 为了防止渲染出现不可预期的结果，在renderer进程中，浏览器设置GUI渲染线程和js引擎线程是互斥的。当js引擎执行时GUI线程会被挂起，GUI更新会等到js引擎空闲时立即被执行。
+ 如此一来，js执行时间过长，GUI更新则会被保存在一个队列中等到js引擎线程空闲立即被执行（准确来说js运行时会停止把新ui更新任务加入到GUI线程的队列中）

## 使用定时器'暂停'js引擎线程

### js事件循环机制

简单介绍下：
+ js引擎执行时遇到异步任务（setTimeout，promise.then等），会将其回调放入由事件触发线程管理的事件队列中，这个队列中的异步任务又分为宏任务（setTimeout）和微任务（如promise.then），可以自己理解为两个队列，一个宏任务队列，一个微任务队列。
+ 在js引擎空闲时，会立马执行当前所有微任务队列中的任务，然后GUI线程进行所有UI更新。这可以当做一个循环。
+ 结束后会将js引擎会执行宏任务队列中的第一个任务（**注意是一个**），执行过程中遇到异步任务和第一次循环一样，分别放入宏任务队列和微任务队列中，执行完js引擎空闲，又会执行微任务队列中的所有任务，更新UI。。。

所以定时器有助于把运行耗时较长的脚本拆分成较短的片段，调用定时器会让js引擎先等待一定时间，可以让GUI线程先更新。

### 使用定时器分割任务
```javascript
一个简单循环：
for (let i = 0, len = items.length; i < len; i++) {
   process(items[i])
}
```
这个循环运行时间过长可能因为process()的复杂度或items的大小。
如果以下两个问题的答案都是**否**，那么可以用定时器来分解任务：
+ 处理过程是否必须同步？
+ 数据是否必须按顺序处理？
  
```javascript
可以将改功能封装起来
function processArray (items, process, callback) {
   let todo = items.concat()

   setTimeout(function () {
      process(todo.shift)
      if (todo.length > 0) {
         setTimeout(arguments.callee, 25)
      } else {
         callback(items)
      }
   }, 25)
}

// 普遍来讲，延时最好使用至少25ms，再小一些的延时，对大多数UI更新来说不够
```

+ 有时每次只执行一个任务的效率并不高。假如有一个长度为1000项的数组，每次处理一项只需要1ms。如果每个定时器中只处理一项，且在两次处理之间产生25ms延迟，意味着处理数组的总时间为(25 + 1) * 1000 = 26000ms(26秒)
+ 但是如果按批处理，一批处理50个，总时长为(1000 / 50) * 25 + 1000 = 1500ms(1.5s)，这样既保证了运行时长，而且用户不会察觉到界面阻塞。

## Web Workers

**注意**：以下的UI线程指的是GUI线程和js引擎线程，因为他们是互斥的，有些书籍和文章就统称UI线程
+ 自js诞生以来，还没有办法在浏览器UI线程之外运行代码。Web Workers引入了一个接口，能使代码运行且不占用浏览器UI线程的时间。
+ 由于Web Workers没有绑定UI线程，意味着他们不能访问浏览器的许多资源（比如操作DOM）
+ 每个Web Worker都有自己的全局运行环境，由如下几部分组成：
  - navigator对象，包括四个属性：appName、appVersion、user Agent和platform（没看到具体解释）
  - location对象（与window.location相同，所有属性都是只读）
  - self对象，指向全局worker对象
  - importScripts方法，用来加载Worker所用到的外部js文件
  - 所有ECMAScript对象，例如：Object、Array、date等
  - XMLHttpRequest构造器
  - setTimeout()和setInterval()方法
  - close()方法，它能立刻停止Worker运行
  
```javascript
// 下一行代码一旦执行，将为这个文件创建一个新的线程和一个新的Worker运行环境。该文件会被异步下载，直到文件下载并执行完成后才会启动此Worker
let worker = new Worker('worker.js')
// 接收Worker传回来信息时触发
worker.onmessage = function (event) {
   console.log(event.data)
}
// 网页代码可以通过postMessage()给Worker传递数据
worker.postMessage('Nicholas')

// worker.js内部代码
// 接收页面传过来信息时触发
self.onmessage = function (event) {
   // Worker通过自己的postMessage()方法把信息传回给页面
   self.postMessage('Hello,' + event.data)
}
```

+ Web Worker适用于那些处理纯数据，或者与浏览器UI无关的长时间运行脚本
+ 如解析一个很大的JSON字符串，假设至少需要500ms，超出了客户端允许js运行的时间（一个js文件最好在100ms以内），会干扰用户体验。而次任务难以分解成若干个使用定时器的小任务，因此Worker成为最理想的解决方案。
+ 适用：
   - 编码/解码大字符串
   - 复杂数学运算（包括图像或视频处理）
   - 大数组排序等
+ 任何超过100ms的处理过程，都应当考虑Worker方案是不是比基于定时器的方案更为合适

## Cesium中的多线程

Cesium中涉及到三维球的很多计算，数据量很大，比如地形的三角网，以及参数化的Geometry中vbo的计算，这些都是在Web Worker中实现的，Cesium基于Web Worker又封装了一层。

### 如何使用？

用户只需要创建一个TaskProcessor，指定具体需要创建线程的类型，比如（圆，面，还是线），然后调用scheduleTask，里面是该对象的具体参数，比如圆就是圆心+半径，这样便完成了调用过程。那返回结果怎么接受呢？注意scheduleTask()返回的是一个promise

看一下cesium源码中的使用
```javascript
var taskProcessor = new TaskProcessor(
  "decodeGoogleEarthEnterprisePacket",
  Number.POSITIVE_INFINITY
);

var decodePromise = taskProcessor.scheduleTask(
   {
      buffer: metadata,
      quadKey: quadKey,
      type: "Metadata",
      key: key,
   },
   [metadata]
   );

    return decodePromise.then(function (result) {
    }
```

TaskProcessor第一个参数是workerName，一般是Worker的脚本名。

### 源码中是如何实现的

```javascript
TaskProcessor的核心部分：

function TaskProcessor(workerName, maximumActiveTasks) {
  this._workerName = workerName;
  this._maximumActiveTasks = defaultValue(maximumActiveTasks, 5);
  this._activeTasks = 0;
  this._deferreds = {};
  this._nextID = 0;
}

TaskProcessor.prototype.scheduleTask = function (
  parameters,
  transferableObjects
) {
  if (!defined(this._worker)) {
    this._worker = createWorker(this);
  }

  if (this._activeTasks >= this._maximumActiveTasks) {
    return undefined;
  }

  ++this._activeTasks;

  var processor = this;
  return when(canTransferArrayBuffer(), function (canTransferArrayBuffer) {
    if (!defined(transferableObjects)) {
      transferableObjects = emptyTransferableObjectArray;
    } else if (!canTransferArrayBuffer) {
      transferableObjects.length = 0;
    }

    var id = processor._nextID++;
    var deferred = when.defer();
    processor._deferreds[id] = deferred;

    processor._worker.postMessage(
      {
        id: id,
        parameters: parameters,
        canTransferArrayBuffer: canTransferArrayBuffer,
      },
      transferableObjects
    );

    return deferred.promise;
  });
};
```

// 可以发现scheduleTask()返回的是一个promise。看一下scheduleTask()方法中调用的createWorker()

```javascript
function createWorker(processor) {
  var worker = new Worker(getBootstrapperUrl());
  worker.postMessage = defaultValue(
    worker.webkitPostMessage,
    worker.postMessage
  );

  var bootstrapMessage = {
    loaderConfig: {
      paths: {
        Workers: buildModuleUrl("Workers"),
      },
      baseUrl: buildModuleUrl.getCesiumBaseUrl().url,
    },
    workerModule: TaskProcessor._workerModulePrefix + processor._workerName,
  };

  worker.postMessage(bootstrapMessage);
  worker.onmessage = function (event) {
    completeTask(processor, event.data);
  };

  return worker;
}

function getBootstrapperUrl() {
  if (!defined(bootstrapperUrlResult)) {
    bootstrapperUrlResult = getWorkerUrl("Workers/cesiumWorkerBootstrapper.js");
  }
  return bootstrapperUrlResult;
}
```

发现new Worker传入的js脚本路径是一样的。首先有一个cesiumWorkerBootstrapper的Worker，所有createWorker都会建立一个cesiumWorkerBootstrapper线程，只是赋予不同的参数（name不同）。再看一下cesiumWorkerBootstrapper.js中的代码

```javascript
// cesiumWorkerBootstrapper.js
self.onmessage = function (event) {
  var data = event.data;
  require(data.loaderConfig, [data.workerModule], function (workerModule) {
    //replace onmessage with the required-in workerModule
    self.onmessage = workerModule;
    CESIUM_BASE_URL = data.loaderConfig.baseUrl;
  });
};

```

在cesiumWorkerBootstrapper线程中，使用了requirejs，根据指定的路径和文件名，获取对应的函数，同时替换的onmessage函数。此时，主线程在调用scheduleTask时，会再次发送postmessage，并传入参数，而此时requirejs已经找到了对应的功能函数。，即替换onmessage的函数。

这块代码涉及的内容比较多，这里也是理解思路，具体的细节还是需要代码的调试才能更好的理解。
