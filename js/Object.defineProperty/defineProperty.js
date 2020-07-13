// 'use strict'

// let person = {}
// person.name // 给person添加一个数据属性，Configurable、Enumerable、Writable默认是true，Value是undefined
// person.name = 'a' // Value特性被设置为'a'

// Object.defineProperty(person, 'name', {
//   configurable: false
// })

// Object.defineProperty(person, 'name', {
//   value: 'b'
// })

// console.log(person.name) // b  configurable为false，writable为true时还能修改

// Object.defineProperty(person, 'name', {
//   writable: false
// })

// person.name = 'c' // error

// Object.defineProperty(person, 'name', {
//   value: 'c',
// }) // error

// Object.defineProperty(person, 'name', {
//   writable: true
// }) // error

// 访问器属性
let person = {}
let _name = 'a'

Object.defineProperty(person, 'name', {
  configurable: true,
  enumerable: true,
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
console.log(Object.getOwnPropertyDescriptor(person, 'name'))

Object.defineProperty(person, 'name', {
  value: 'd'
})

console.log(person.name)
console.log(Object.getOwnPropertyDescriptor(person, 'name'))

person.age = 14
let _age = 12
console.log(Object.getOwnPropertyDescriptor(person, 'age'))
Object.defineProperty(person, 'name', {
  set: function () {
    _age = 14
  }
})

console.log(_age)
console.log(Object.getOwnPropertyDescriptor(person, 'age'))