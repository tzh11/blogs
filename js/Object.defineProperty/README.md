# 浅析Object.defineProperty()

## Object.defineProperty()

该方法会直接在一个对象上定义一个新属性，或者修改一个对象的现有属性，并返回此对象  

有人会问那和.操作符或者[]操作符有什么区别呢，区别在于Object.defineProperty()能够更深入地定义一个对象，
它操作的不仅仅是属性的值，也可以修改属性的一些特性，比如是否可修改，是否可遍历，当然值也是属性其中的特性之一

Object.defineProperty(obj, prop, descriptor)接受3个参数：  

+ obj: 要操作的对象
+ prop: 要操作的属性
+ descriptor: 描述符对象。包含6个属性：configurable、enumerable、writable、value、get、set
  
注意：应当直接在Object构造器对象上调用此方法，而不是在任意一个Object类型的实例上调用。

## 属性类型

### 1、数据属性

数据属性包含一个数据值的位置。在这个位置可以读取和写入值

数据属性有4个描述其行为的特性：

+ configurable: 能否通过delete删除属性，能否修改属性特性（注意是特性），能否修改为访问器属性，默认是true
+ enumerable: 能否通过for-in遍历到该属性，默认是true
+ writable: 能否修改属性值，默认是true
+ value: 这个属性的数据值。读取属性值的时候，从这里读取；写入属性值得时候，把新值保存在这个位置。默认是undefined

例如:

```javascript
let person = {}
person.name // 给person添加一个数据属性，Configurable、Enumerable、Writable默认是true，Value是undefined
person.name = 'a' // Value特性被设置为'a'
```

如果将configurable设置为false 那么除了value和writable之外的特性都不能被修改（本身也不能再改为true了），如果修改会被忽略，严格模式会报错。  
在configurable为false的情况下，writable为true可修改为false，如果writable为false，修改为true也会被忽略，严格模式报错。

```javascript
Object.defineProperty(person, 'name', {
  configurable: false
})

Object.defineProperty(person, 'name', {
  value: 'b'
})

console.log(person.name) // b  configurable为false，writable为true时还能修改

Object.defineProperty(person, 'name', {
  writable: false
})

person.name = 'c' // error

Object.defineProperty(person, 'name', {
  writable: true
}) // error
```

### 2、访问器属性

访问器属性不包含数据值，包含一对getter和setter函数（不需要同时存在）。  
访问器属性必须通过Object.defineProperty定义。访问器属性有以下四个特性：

+ configurable: 能否通过delete删除属性，能否修改属性特性（注意是特性），能否修改为数据属性，默认是true
+ enumerable: 能否通过for-in遍历到该属性，默认是true
+ get: 在读取属性时调用的函数。默认值是undefined
+ set: 在写入属性时调用的函数。默认是undefined
  
```javascript
let person = {}
let _name = 'a'

Object.defineProperty(person, 'name', {
  get: function () {
    return _name
  },
  set: function (newVal) {
    (newVal !== _name) && (_name = newVal)
  }
})

_name = 'b'
console.log(person.name) // b

person.name = 'c'
console.log(_name) // c

// 是不是和vue的双向绑定很像呢
```

get和set特性在设置了configurable为false的时候一样被设置会被忽略，严格模式报错

## 数据属性和访问器属性相互转换

+ 数据属性 -> 访问器属性
  
给数据属性设置了get或set特性，value和writable特性就会被废弃，该属性变为访问器属性

+ 访问器属性 -> 数据属性

给访问器属性设置了value或writable特性，get和set特性就会被废弃，该属性变为数据属性

注意：只有在configurable为true的情况下才可以相互转换，即使数据属性中在configurable为false的情况可以修改value或writable，  
访问器属性转数据属性只设置value或writable也不行。


