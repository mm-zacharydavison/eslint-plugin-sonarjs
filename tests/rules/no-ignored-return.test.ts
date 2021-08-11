/*
 * eslint-plugin-sonarjs
 * Copyright (C) 2018-2021 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import { readFileSync } from 'fs';
import * as path from 'path';
import * as rule from '../../src/rules/no-ignored-return';
import { RuleTester } from '../rule-tester';

const filename = path.resolve(`${__dirname}/../resources/file.ts`);
const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2018,
    project: path.resolve(`${__dirname}/../resources/tsconfig.json`),
  },
});

ruleTester.run('Return values from functions without side effects should not be ignored', rule, {
  valid: [
    {
      filename,
      code: `
      function returnIsNotIgnored() {
        var x = "abc".concat("bcd");

        if ([1, 2, 3].lastIndexOf(42)) {
          return true;
        }
      }`,
    },
    {
      filename,
      code: `
      function noSupportForUserTypes() {
        class A {
          methodWithoutSideEffect() {
            return 42;
          }
        }

        (new A()).methodWithoutSideEffect(); // OK
      }`,
    },
    {
      filename,
      code: `
      function unknownType(x: any) {
        x.foo();
      }`,
    },
    {
      filename,
      code: `
      function computedPropertyOnDestructuring(source: any, property: string) { // OK, used as computed property name
        const { [property]: _, ...rest } = source;
        return rest;
      }`,
    },
    {
      filename,
      code: `
      // "some" and "every" are sometimes used to provide early termination for loops
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
      [1, 2, 3].some(function(el) {
        return el === 2;
      });

      [1,2,3].every(function(el) {
        return ! el !== 2;
      });
            `,
    },
    {
      filename,
      code: `
      function methodsOnString() {
        // "replace" with callback is OK
        "abc".replace(/ab/, () => "");
        "abc".replace(/ab/, function() {return ""});
      }`,
    },
    {
      filename,
      code: `
      function myCallBack() {}
      function methodsOnString() {
        // "replace" with callback is OK
        "abc".replace(/ab/, myCallBack);
      }`,
    },
    {
      filename,
      code: `
      class MyClass {
        myMethod() { return 1 }
      }
      const instance = new MyClass()
      const foo = instance.myMethod()
      `,
      options: [{ custom: { methods: { MyClass: ['myMethod'] } } }],
    },
    {
      filename,
      code: `
      function myFunction() { return 1 }
      const foo = myFunction()
      `,
      options: [{ custom: { functions: ['myFunction'] } }],
    },
    {
      filename,
      code: `
      function myFunction() { return 1 }
      let foo
      foo = myFunction()
      `,
      options: [{ custom: { functions: ['myFunction'] } }],
    },
    {
      filename,
      code: `
      function myFunction() { return 1 }
      perform(myFunction())
      `,
      options: [{ custom: { functions: ['myFunction'] } }],
    },
  ],
  invalid: [
    {
      filename,
      code: `
      function methodsOnMath() {
        let x = -42;
        Math.abs(x);
      }`,
      errors: [
        {
          message: `The return value of "abs" must be used.`,
          line: 4,
          endLine: 4,
          column: 9,
          endColumn: 20,
        },
      ],
    },
    {
      filename,
      code: `
      function methodsOnMath() {
        let x = -42;
        Math.abs(x);
      }`,
      errors: [
        {
          message: `The return value of "abs" must be used.`,
          line: 4,
          endLine: 4,
          column: 9,
          endColumn: 20,
        },
      ],
    },
    {
      filename,
      code: `
      function mapOnArray() {
        let arr = [1, 2, 3];
        arr.map(function(x){ });
      }`,
      errors: [
        {
          message: `Consider using "forEach" instead of "map" as its return value is not being used here.`,
        },
      ],
    },
    {
      filename,
      code: `
      function methodsOnArray(arr1: any[]) {
        let arr = [1, 2, 3];

        arr.slice(0, 2);

        arr1.join(",");
      }`,
      errors: 2,
    },
    {
      filename,
      code: `
      function methodsOnString() {
        let x = "abc";
        x.concat("abc");
        "abc".concat("bcd");
        "abc".concat("bcd").charCodeAt(2);
        "abc".replace(/ab/, "d");
      }`,
      errors: 4,
    },
    {
      filename,
      code: `
      function methodsOnNumbers() {
        var num = 43 * 53;
        num.toExponential();
      }`,
      errors: 1,
    },
    {
      filename,
      code: `
      function methodsOnRegexp() {
        var regexp = /abc/;
        regexp.test("my string");
      }`,
      errors: 1,
    },
    {
      filename,
      code: `
      function methodsOnRegexp() {
        var regexp = /abc/;
        regexp.test("my string");
      }`,
      errors: 1,
    },
    {
      filename,
      code: `
      class MyClass {
        myMethod() { return 1 }
      }
      const instance = new MyClass()
      instance.myMethod()
      `,
      options: [{ custom: { methods: { MyClass: ['myMethod'] } } }],
      errors: 1,
    },
    {
      filename,
      code: `
      function myFunction() { return 1 }
      myFunction()
      `,
      options: [{ custom: { functions: ['myFunction'] } }],
      errors: 1,
    },
    {
      filename,
      code: `
      import { myFunction } from 'some-module'
      myFunction()
      `,
      options: [{ custom: { functions: ['myFunction'] } }],
      errors: 1,
    },
    {
      filename,
      code: `
      import { createAction } from 'action-creators'

      const middleware: Middleware = ({ dispatch, getState }) => {
        return next => action => {
          createAction(Action.MY_ACTION)
        }
      }
      `,
      options: [{ custom: { functions: ['createAction'] } }],
      errors: 1,
    },
    {
      filename,
      code: `
      import { sendLog } from 'sendLog'

      export default class RequestPage extends React.Component<{}, RequestPageState> {
        componentDidMount() {
          this.load().then(() => {
            sendLog(BQEventTypes.web.TUTORIAL_DIALOG, {
              bucket: 'treatment',
              request_id: getId(request),
              service_id: getId(request.service),
            })
          })
        }
      }
      `,
      options: [{ custom: { functions: ['sendLog'] } }],
      errors: 1,
    },
    {
      filename,
      code: readFileSync('tests/rules/meetsmore.js', 'utf8'),
      options: [{ custom: { functions: ['sendLog'] } }],
      errors: 2,
    },
  ],
});
